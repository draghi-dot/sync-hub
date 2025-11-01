"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Video, VideoOff, Mic, MicOff, Users, X } from "lucide-react"
import { MobileNav } from "@/components/mobile-nav"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"

interface Participant {
  id: string
  name: string
  avatar_url: string | null
}

export default function DepartmentMeetingPage() {
  const params = useParams()
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [userName, setUserName] = useState<string>("")
  const [participants, setParticipants] = useState<Participant[]>([])
  const [activeMeetingParticipants, setActiveMeetingParticipants] = useState<Map<string, Participant>>(new Map())
  const [isVideoOn, setIsVideoOn] = useState(true)
  const [isAudioOn, setIsAudioOn] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [departmentName, setDepartmentName] = useState<string>("")
  const [isRecording, setIsRecording] = useState(false)
  const [isGeneratingTranscript, setIsGeneratingTranscript] = useState(false)
  const [chatId, setChatId] = useState<string | null>(null)
  const [callDuration, setCallDuration] = useState<number>(0) // Duration in seconds
  
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map())
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map())
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map())
  const localStreamRef = useRef<MediaStream | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordedChunksRef = useRef<Blob[]>([])
  const meetingStartTimeRef = useRef<Date | null>(null)

  const teamId = params?.teamId as string
  const departmentId = params?.departmentId as string

  useEffect(() => {
    // Get current user and department members
    const initUser = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push("/auth/login")
        return
      }

      setUserId(user.id)

      // Get user's profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, company, department")
        .eq("id", user.id)
        .single()

      if (profile?.full_name) {
        setUserName(profile.full_name)
      }

      // Get department details with team info for verification
      const { data: department, error: deptError } = await supabase
        .from("departments")
        .select(`
          name,
          teams:team_id (
            company
          )
        `)
        .eq("id", departmentId)
        .single()

      if (deptError || !department) {
        console.error("Error fetching department:", deptError)
        setError("Department not found")
        setIsLoading(false)
        return
      }

      // Verify user belongs to this department's company
      // Note: teams is returned as an array from Supabase even for single relationships
      const teamCompany = Array.isArray(department.teams) 
        ? (department.teams[0] as any)?.company 
        : (department.teams as any)?.company
      
      if (teamCompany && profile?.company && teamCompany !== profile.company) {
        setError("You don't have access to this department's meeting")
        setIsLoading(false)
        setTimeout(() => router.push("/teams"), 2000)
        return
      }

      // Verify user is assigned to this department
      const { data: userDepts, error: userDeptsError } = await supabase
        .from("user_departments")
        .select(`
          departments (
            name
          )
        `)
        .eq("user_id", user.id)

      const userDepartmentNames = userDeptsError 
        ? (profile?.department ? [profile.department] : [])
        : (userDepts?.map((ud: any) => ud.departments?.name).filter(Boolean) || [])

      const isAssigned = userDepartmentNames.length === 0 || userDepartmentNames.some(
        (deptName: string) => deptName.trim().toLowerCase() === department.name.trim().toLowerCase()
      )

      if (!isAssigned && userDepartmentNames.length > 0) {
        setError("You are not assigned to this department")
        setIsLoading(false)
        setTimeout(() => router.push("/teams"), 2000)
        return
      }

      if (department) {
        setDepartmentName(department.name)
      }

      // Get all users in this department (including current user for participant count)
      const { data: departmentUsers, error: deptUsersError } = await supabase
        .from("user_departments")
        .select(`
          user_id,
          profiles!user_departments_user_id_fkey (
            id,
            full_name,
            avatar_url
          )
        `)
        .eq("department_id", departmentId)

      if (deptUsersError) {
        console.error("Error fetching department members:", deptUsersError)
      } else if (departmentUsers) {
        const otherUsers = departmentUsers
          .filter((du: any) => du.user_id !== user.id && du.profiles)
          .map((du: any) => ({
            id: du.profiles.id,
            name: du.profiles.full_name || "Unknown",
            avatar_url: du.profiles.avatar_url
          }))
        setParticipants(otherUsers)
      }

      // Get the department chat ID (general chat)
      const { data: departmentChats } = await supabase
        .from("chats")
        .select("id")
        .eq("department_id", departmentId)
        .eq("type", "department")
        .eq("name", "general")
        .order("created_at", { ascending: true })
        .limit(1)

      if (departmentChats && departmentChats.length > 0) {
        setChatId(departmentChats[0].id)
      }

      setIsLoading(false)
    }
    initUser()
  }, [router, departmentId])

  useEffect(() => {
    if (!userId || !departmentId || isLoading) return

    const supabase = createClient()
    let meetingChannel: ReturnType<typeof supabase.channel> | null = null

    // Start video call
    const startCall = async () => {
      try {
        // Request camera and microphone permissions
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720 },
          audio: true
        })

        localStreamRef.current = stream
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream
        }

        // Start recording the meeting audio
        startRecording(stream)
        
        // Set up Supabase Realtime channel for WebRTC signaling (must be done before broadcasting)
        meetingChannel = supabase.channel(`meeting:${departmentId}`, {
          config: {
            broadcast: { self: true },
            presence: { key: userId },
          },
        })
        
        // Broadcast meeting start time for synchronization
        const meetingStartTime = Date.now()
        meetingStartTimeRef.current = new Date(meetingStartTime)
        
        // Subscribe to channel first, then broadcast
        meetingChannel.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            // Broadcast start time so all users see synchronized time
            meetingChannel?.send({
              type: 'broadcast',
              event: 'meeting-started',
              payload: { startTime: meetingStartTime }
            })
          }
        })
        
        // Start call duration timer (will be updated when we receive the shared start time)
        const durationInterval = setInterval(() => {
          const startTime = meetingStartTimeRef.current?.getTime() || Date.now()
          setCallDuration(Math.floor((Date.now() - startTime) / 1000))
        }, 1000)
        
        // Store interval for cleanup
        ;(window as any).__meetingDurationInterval = durationInterval

        // Handle meeting start time synchronization
        meetingChannel
          .on("broadcast", { event: "meeting-started" }, (payload) => {
            const { startTime } = payload.payload as { startTime: number }
            console.log("Received meeting start time:", startTime)
            // Update shared start time if we don't have one or if this is earlier
            if (!meetingStartTimeRef.current || startTime < meetingStartTimeRef.current.getTime()) {
              meetingStartTimeRef.current = new Date(startTime)
              console.log("Updated meeting start time to:", meetingStartTimeRef.current)
            }
          })

        // Handle new participants joining
        meetingChannel
          .on("broadcast", { event: "user-joined" }, (payload) => {
            const { userId: peerUserId, userName: peerUserName } = payload.payload as { userId: string, userName?: string }
            if (peerUserId !== userId) {
              console.log("New user joined, creating peer connection:", peerUserId)
              // Add to active participants immediately
              setActiveMeetingParticipants((prev) => {
                const updated = new Map(prev)
                if (!updated.has(peerUserId)) {
                  const participantInfo = participants.find(p => p.id === peerUserId) || {
                    id: peerUserId,
                    name: peerUserName || "User",
                    avatar_url: null
                  }
                  updated.set(peerUserId, participantInfo)
                }
                return updated
              })
              
              // Only create connection if we don't already have one
              // Use user ID comparison to determine who offers (lower ID offers to avoid race condition)
              const existingPc = peerConnections.current.get(peerUserId)
              if (!existingPc && userId && peerUserId) {
                const isOfferer = userId < peerUserId
                createPeerConnection(peerUserId, isOfferer)
              }
            }
          })
          .on("broadcast", { event: "offer" }, async (payload) => {
            const { offer, fromUserId } = payload.payload as { offer: RTCSessionDescriptionInit, fromUserId: string }
            if (fromUserId !== userId) {
              console.log("Received offer from:", fromUserId)
              
              // Add to active participants if not already there
              setActiveMeetingParticipants((prev) => {
                const updated = new Map(prev)
                if (!updated.has(fromUserId)) {
                  const participantInfo = participants.find(p => p.id === fromUserId) || {
                    id: fromUserId,
                    name: "User",
                    avatar_url: null
                  }
                  updated.set(fromUserId, participantInfo)
                }
                return updated
              })
              
              // Check if we already have a connection, if not create one
              let pc = peerConnections.current.get(fromUserId)
              if (!pc) {
                pc = createPeerConnection(fromUserId, false) // false = we are the answerer
              }
              
              await pc.setRemoteDescription(new RTCSessionDescription(offer))
              
              // If local description is not set yet, create answer
              if (!pc.localDescription) {
                const answer = await pc.createAnswer()
                await pc.setLocalDescription(answer)
                
                // Send answer back
                meetingChannel?.send({
                  type: "broadcast",
                  event: "answer",
                  payload: { answer, fromUserId: userId, toUserId: fromUserId },
                })
              }
            }
          })
          .on("broadcast", { event: "answer" }, async (payload) => {
            const { answer, fromUserId } = payload.payload as { answer: RTCSessionDescriptionInit, fromUserId: string }
            if (fromUserId !== userId) {
              console.log("Received answer from:", fromUserId)
              
              // Add to active participants if not already there
              setActiveMeetingParticipants((prev) => {
                const updated = new Map(prev)
                if (!updated.has(fromUserId)) {
                  const participantInfo = participants.find(p => p.id === fromUserId) || {
                    id: fromUserId,
                    name: "User",
                    avatar_url: null
                  }
                  updated.set(fromUserId, participantInfo)
                }
                return updated
              })
              
              const pc = peerConnections.current.get(fromUserId)
              if (pc) {
                await pc.setRemoteDescription(new RTCSessionDescription(answer))
              }
            }
          })
          .on("broadcast", { event: "ice-candidate" }, async (payload) => {
            const { candidate, fromUserId } = payload.payload as { candidate: RTCIceCandidateInit, fromUserId: string }
            if (fromUserId !== userId) {
              console.log("Received ICE candidate from:", fromUserId)
              const pc = peerConnections.current.get(fromUserId)
              if (pc && candidate) {
                await pc.addIceCandidate(new RTCIceCandidate(candidate))
              }
            }
          })
          .on("presence", { event: "sync" }, () => {
            const state = meetingChannel?.presenceState()
            console.log("Presence state:", state)
            // Create connections for existing participants and add them to active list
            if (state && userId) {
              Object.keys(state).forEach((presenceKey) => {
                if (presenceKey !== userId) {
                  // Add to active participants
                  setActiveMeetingParticipants((prev) => {
                    const updated = new Map(prev)
                    if (!updated.has(presenceKey)) {
                      const presenceData = state[presenceKey]?.[0] as any
                      const participantInfo = participants.find(p => p.id === presenceKey) || {
                        id: presenceKey,
                        name: presenceData?.userName || "User",
                        avatar_url: null
                      }
                      updated.set(presenceKey, participantInfo)
                    }
                    return updated
                  })
                  
                  const existingPc = peerConnections.current.get(presenceKey)
                  if (!existingPc) {
                    console.log("Found existing participant, creating connection:", presenceKey)
                    // Use user ID comparison to determine who offers (lower ID offers)
                    const isOfferer = userId < presenceKey
                    createPeerConnection(presenceKey, isOfferer)
                  }
                }
              })
            }
          })
          .subscribe(async (status) => {
            console.log("Meeting channel subscription status:", status)
            if (status === "SUBSCRIBED") {
              // Set our presence
              await meetingChannel?.track({
                userId: userId,
                userName: userName,
                joinedAt: new Date().toISOString(),
              })
              
              // Announce that we joined (this triggers others to connect to us)
              // Send multiple times to ensure everyone receives it
              meetingChannel?.send({
                type: "broadcast",
                event: "user-joined",
                payload: { userId, userName },
              })
              
              // Also send a delayed announcement in case someone joins right after
              setTimeout(() => {
                meetingChannel?.send({
                  type: "broadcast",
                  event: "user-joined",
                  payload: { userId, userName },
                })
              }, 1000)
            }
          })

        setError(null)
      } catch (err: any) {
        console.error("Error accessing media devices:", err)
        if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
          setError("Camera and microphone access is required. Please allow access and refresh.")
        } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
          setError("No camera or microphone found. Please connect a device.")
        } else {
          setError("Failed to access camera/microphone. Please check permissions.")
        }
      }
    }

    // Create peer connection with another user
    const createPeerConnection = (peerUserId: string, isOfferer: boolean): RTCPeerConnection => {
      // Close existing connection if any
      const existingPc = peerConnections.current.get(peerUserId)
      if (existingPc) {
        existingPc.close()
      }

      const pc = new RTCPeerConnection({
        iceServers: [
          // STUN servers for discovering public IP
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
          // TURN servers for relaying when direct connection fails
          { 
            urls: "turn:openrelay.metered.ca:80", 
            username: "openrelayproject", 
            credential: "openrelayproject" 
          },
          { 
            urls: "turn:openrelay.metered.ca:443", 
            username: "openrelayproject", 
            credential: "openrelayproject" 
          },
          { 
            urls: "turn:openrelay.metered.ca:443?transport=tcp", 
            username: "openrelayproject", 
            credential: "openrelayproject" 
          },
          {
            urls: "turn:relay.metered.ca:80",
            username: "openrelayproject",
            credential: "openrelayproject"
          },
          {
            urls: "turn:relay.metered.ca:443",
            username: "openrelayproject",
            credential: "openrelayproject"
          },
          {
            urls: "turn:relay.metered.ca:443?transport=tcp",
            username: "openrelayproject",
            credential: "openrelayproject"
          },
        ],
        iceCandidatePoolSize: 10,
      })

      // Add local stream tracks
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current!)
        })
      }

      // Handle remote stream
      pc.ontrack = (event) => {
        console.log("🎥 Received remote track from:", peerUserId, "Track kind:", event.track.kind, "Streams:", event.streams.length)
        
        if (event.streams && event.streams.length > 0) {
          const remoteStream = event.streams[0]
          // Store the stream immediately
          remoteStreamsRef.current.set(peerUserId, remoteStream)
          console.log("✅ Stored remote stream for:", peerUserId, "Tracks:", remoteStream.getTracks().length)
          
          // Add to active participants if not already there (so both users see each other)
          setActiveMeetingParticipants((prev) => {
            const updated = new Map(prev)
            if (!updated.has(peerUserId)) {
              const participantInfo = participants.find(p => p.id === peerUserId) || {
                id: peerUserId,
                name: "User",
                avatar_url: null
              }
              updated.set(peerUserId, participantInfo)
              console.log("✅ Added to active participants from track:", peerUserId)
            }
            return updated
          })
          
          // Try to apply it to the video element if it exists
          const remoteVideo = remoteVideoRefs.current.get(peerUserId)
          if (remoteVideo) {
            console.log("✅ Video element exists, setting stream immediately")
            remoteVideo.srcObject = remoteStream
            
            // Play video with better error handling
            const playPromise = remoteVideo.play()
            if (playPromise !== undefined) {
              playPromise.catch(err => {
                // Ignore AbortError - it's just a race condition, video will play anyway
                if (err.name !== 'AbortError') {
                  console.error("Error playing remote video:", err)
                }
              })
            }
            
            // Hide placeholder
            const placeholder = document.getElementById(`placeholder-${peerUserId}`)
            if (placeholder) {
              placeholder.style.display = 'none'
            }
          } else {
            console.log("⏳ Video element not ready yet, will apply when created")
          }
        }
      }

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate && meetingChannel) {
          meetingChannel.send({
            type: "broadcast",
            event: "ice-candidate",
            payload: {
              candidate: event.candidate.toJSON(),
              fromUserId: userId,
              toUserId: peerUserId,
            },
          })
        }
      }

      pc.onconnectionstatechange = () => {
        console.log(`🔗 Connection state with ${peerUserId}:`, pc.connectionState)
        if (pc.connectionState === "failed") {
          console.warn("❌ Connection failed, restarting ICE...")
          // Try to reconnect
          pc.restartIce()
        } else if (pc.connectionState === "connected") {
          console.log("✅ Connected to:", peerUserId)
        }
      }
      
      pc.oniceconnectionstatechange = () => {
        console.log(`🧊 ICE connection state with ${peerUserId}:`, pc.iceConnectionState)
      }

      peerConnections.current.set(peerUserId, pc)

      // If we're the offerer, create and send offer
      if (isOfferer) {
        pc.createOffer()
          .then((offer) => {
            return pc.setLocalDescription(offer)
          })
          .then(() => {
            if (meetingChannel && pc.localDescription) {
              meetingChannel.send({
                type: "broadcast",
                event: "offer",
                payload: {
                  offer: pc.localDescription.toJSON(),
                  fromUserId: userId,
                  toUserId: peerUserId,
                },
              })
            }
          })
          .catch((error) => {
            console.error("Error creating offer:", error)
          })
      }

      return pc
    }

    startCall()

    // Cleanup on unmount
    return () => {
      // Clear duration timer
      if ((window as any).__meetingDurationInterval) {
        clearInterval((window as any).__meetingDurationInterval)
      }
      // Stop recording if active
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop()
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop())
      }
      peerConnections.current.forEach(pc => pc.close())
      peerConnections.current.clear()
      if (meetingChannel) {
        supabase.removeChannel(meetingChannel)
      }
    }
  }, [userId, departmentId, isLoading])

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.enabled = !isVideoOn
        setIsVideoOn(!isVideoOn)
      }
    }
  }

  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !isAudioOn
        setIsAudioOn(!isAudioOn)
      }
    }
  }

  const startRecording = (stream: MediaStream) => {
    try {
      // Get audio tracks only for recording
      const audioTracks = stream.getAudioTracks()
      if (audioTracks.length === 0) {
        console.warn("No audio tracks available for recording")
        return
      }

      // Create a new stream with only audio tracks
      const audioStream = new MediaStream(audioTracks)

      const mediaRecorder = new MediaRecorder(audioStream, {
        mimeType: "audio/webm;codecs=opus"
      })

      mediaRecorderRef.current = mediaRecorder
      recordedChunksRef.current = []
      meetingStartTimeRef.current = new Date()

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        // Don't generate transcript here - it will be generated when last person leaves
        console.log("Recording stopped, but transcript will be generated when last person leaves")
      }

      // Start recording
      mediaRecorder.start(1000) // Collect data every second
      setIsRecording(true)
      console.log("Recording started")
    } catch (error) {
      console.error("Error starting recording:", error)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      console.log("Recording stopped")
    }
  }

  const generateAndSendTranscript = async () => {
    if (!userId || !chatId || recordedChunksRef.current.length === 0) {
      console.error("Missing required data for transcript generation")
      return
    }

    setIsGeneratingTranscript(true)

    try {
      const supabase = createClient()

      // Combine all recorded chunks into a single blob
      const audioBlob = new Blob(recordedChunksRef.current, { type: "audio/webm" })

      // Create FormData for transcription API
      const formData = new FormData()
      formData.append("audio", audioBlob, "meeting-recording.webm")

      // Call transcription API
      const transcriptionResponse = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      })

      if (!transcriptionResponse.ok) {
        let errorData
        try {
          errorData = await transcriptionResponse.json()
        } catch (e) {
          const text = await transcriptionResponse.text()
          errorData = { error: "Unknown error", details: text || `HTTP ${transcriptionResponse.status}` }
        }
        
        const errorMessage = errorData.details 
          ? `${errorData.error}: ${errorData.details}`
          : errorData.error || "Failed to transcribe audio"
        
        console.error("Transcription API error:", JSON.stringify(errorData, null, 2))
        console.error("Response status:", transcriptionResponse.status)
        console.error("Response status text:", transcriptionResponse.statusText)
        
        throw new Error(errorMessage)
      }

      const { transcript } = await transcriptionResponse.json()

      if (!transcript || transcript.trim().length === 0) {
        throw new Error("Transcript is empty")
      }

      // Format date as dd.mm.yyyy
      const today = new Date()
      const day = String(today.getDate()).padStart(2, "0")
      const month = String(today.getMonth() + 1).padStart(2, "0")
      const year = today.getFullYear()
      const fileName = `${day}.${month}.${year}.txt`

      // Create text file from transcript
      const transcriptBlob = new Blob([transcript], { type: "text/plain" })
      const transcriptFile = new File([transcriptBlob], fileName, { type: "text/plain" })

      // Upload transcript file to Supabase Storage
      const filePath = `${chatId}/${fileName}`
      const { error: uploadError } = await supabase.storage
        .from("chat-files")
        .upload(filePath, transcriptFile, {
          cacheControl: "3600",
          upsert: false,
        })

      if (uploadError) {
        console.error("Error uploading transcript:", uploadError)
        throw uploadError
      }

      // Get public URL for the file
      const { data: { publicUrl } } = supabase.storage
        .from("chat-files")
        .getPublicUrl(filePath)

      // Send transcript file as message to department chat
      const { error: messageError } = await supabase
        .from("messages")
        .insert({
          chat_id: chatId,
          sender_id: userId,
          content: `Meeting transcript - ${departmentName}`,
          file_url: publicUrl,
          file_name: fileName,
          is_ai_transcript: true,
        })

      if (messageError) {
        console.error("Error sending transcript message:", messageError)
        throw messageError
      }

      console.log("Transcript generated and sent successfully")
    } catch (error: any) {
      console.error("Error generating transcript:", error)
      setError(`Failed to generate transcript: ${error.message}`)
    } finally {
      setIsGeneratingTranscript(false)
    }
  }

  const handleLeave = async () => {
    // Wait for transcript generation if in progress
    if (isGeneratingTranscript) {
      setError("Please wait for transcript generation to complete...")
      return
    }

    const supabase = createClient()
    
    // Stop recording first
    if (isRecording && mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      stopRecording()
    }
    
    // Remove our presence from the meeting
    const meetingChannel = supabase.channel(`meeting:${departmentId}`)
    await meetingChannel.untrack()
    
    // Check if we're the last person leaving (wait a bit for presence to sync)
    const checkAndGenerate = async () => {
      const presenceState = meetingChannel.presenceState()
      const remainingParticipants = Object.keys(presenceState || {}).filter(key => key !== userId)
      
      console.log("Remaining participants after leaving:", remainingParticipants.length)
      
      // If we're the last person (or only one left), generate transcript
      if (remainingParticipants.length === 0 && recordedChunksRef.current.length > 0) {
        console.log("Last person leaving, generating transcript...")
        await generateAndSendTranscript()
      } else {
        console.log("Other participants still in call, not generating transcript")
      }
      
      // Clean up media streams
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop())
      }
      peerConnections.current.forEach(pc => pc.close())
      if (wsRef.current) {
        wsRef.current.close()
      }
      
      // Clear duration timer
      if ((window as any).__meetingDurationInterval) {
        clearInterval((window as any).__meetingDurationInterval)
      }

      router.push(`/teams/${teamId}/departments/${departmentId}`)
    }
    
    // Wait a bit for presence to sync, then check
    setTimeout(checkAndGenerate, 1000)
  }

  return (
    <div className="flex flex-col h-screen bg-gray-900">
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-3">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" asChild>
                <Link href={`/teams/${teamId}/departments/${departmentId}`}>
                  <ArrowLeft className="h-5 w-5 text-white" />
                </Link>
              </Button>
              <h1 className="text-white font-semibold">
                Daily Meeting - {departmentName || "Department"}
              </h1>
              {isRecording && (
                <div className="flex items-center gap-2 text-red-400 text-sm">
                  <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
                  <span>Recording</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 text-white text-sm">
                <Users className="h-4 w-4" />
                <span>{activeMeetingParticipants.size + 1}</span>
              </div>
              <Button
                onClick={handleLeave}
                variant="destructive"
                size="icon"
                className="bg-red-600 hover:bg-red-700 text-white shadow-md"
                disabled={isGeneratingTranscript}
                title={isGeneratingTranscript ? "Processing..." : "End Call"}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>
          {/* Call Duration Bar */}
          <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
            <div className="h-full bg-white" style={{ width: '100%' }} />
          </div>
          <div className="text-white text-xs mt-1 text-center">
            Call Duration: {Math.floor(callDuration / 60)}:{(callDuration % 60).toString().padStart(2, '0')}
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4 relative">
        {(error || isGeneratingTranscript) && (
          <div className={`absolute top-4 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-lg z-50 ${
            error ? "bg-red-500 text-white" : "bg-blue-500 text-white"
          }`}>
            {error || "Generating transcript..."}
          </div>
        )}

        {isLoading ? (
          <div className="text-white">Loading...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-6xl w-full">
            {/* Local video */}
            <div className="relative bg-gray-800 rounded-lg overflow-hidden aspect-video border-2 border-blue-500">
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
              />
              {!isVideoOn && (
                <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
                  <div className="text-white text-center">
                    <VideoOff className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Camera Off</p>
                  </div>
                </div>
              )}
              <div className="absolute bottom-2 left-2 bg-black bg-opacity-70 text-white px-3 py-1 rounded text-sm font-medium">
                {userName || "You"}
              </div>
            </div>

            {/* Remote videos - show active meeting participants */}
            {Array.from(activeMeetingParticipants.values()).map((participant) => {
              const hasStream = remoteStreamsRef.current.has(participant.id)
              
              return (
                <div key={participant.id} className="relative bg-gray-800 rounded-lg overflow-hidden aspect-video border-2 border-gray-600">
                  <video
                    ref={(el) => {
                      if (el) {
                        remoteVideoRefs.current.set(participant.id, el)
                        console.log("✅ Video element created for participant:", participant.id)
                        
                        // If we have a stored stream, apply it now
                        const storedStream = remoteStreamsRef.current.get(participant.id)
                        if (storedStream) {
                          console.log("✅ Applying stored stream to video element:", participant.id)
                          el.srcObject = storedStream
                          
                          // Play video with better error handling
                          const playPromise = el.play()
                          if (playPromise !== undefined) {
                            playPromise.catch(err => {
                              // Ignore AbortError - it's just a race condition, video will play anyway
                              if (err.name !== 'AbortError') {
                                console.error("Error playing video:", err)
                              }
                            })
                          }
                          
                          // Hide placeholder
                          setTimeout(() => {
                            const placeholder = document.getElementById(`placeholder-${participant.id}`)
                            if (placeholder) {
                              placeholder.style.display = 'none'
                              console.log("✅ Hid placeholder for:", participant.id)
                            }
                          }, 100)
                        }
                      }
                    }}
                    autoPlay
                    playsInline
                    muted={false}
                    className="w-full h-full object-cover"
                  />
                  {!hasStream && (
                    <div className="absolute inset-0 bg-gray-900 flex items-center justify-center" id={`placeholder-${participant.id}`}>
                      <div className="text-white text-center">
                        <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">{participant.name}</p>
                        <p className="text-xs text-gray-400 mt-1">Connecting...</p>
                      </div>
                    </div>
                  )}
                  <div className="absolute bottom-2 left-2 bg-black bg-opacity-70 text-white px-3 py-1 rounded text-sm font-medium">
                    {participant.name}
                  </div>
                </div>
              )
            })}

            {activeMeetingParticipants.size === 0 && (
              <div className="col-span-1 md:col-span-2 lg:col-span-3 text-center text-gray-400 py-8">
                <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Waiting for other department members to join...</p>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="bg-gray-800 border-t border-gray-700 px-4 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-center gap-4 flex-wrap">
          <Button
            onClick={toggleVideo}
            variant={isVideoOn ? "default" : "destructive"}
            size="lg"
            className="rounded-full px-6"
          >
            {isVideoOn ? <Video className="h-5 w-5 mr-2" /> : <VideoOff className="h-5 w-5 mr-2" />}
            {isVideoOn ? "Camera On" : "Camera Off"}
          </Button>
          <Button
            onClick={toggleAudio}
            variant={isAudioOn ? "default" : "destructive"}
            size="lg"
            className="rounded-full px-6"
          >
            {isAudioOn ? <Mic className="h-5 w-5 mr-2" /> : <MicOff className="h-5 w-5 mr-2" />}
            {isAudioOn ? "Mic On" : "Mic Off"}
          </Button>
        </div>
      </footer>

      <MobileNav userId={userId || ""} />
    </div>
  )
}

