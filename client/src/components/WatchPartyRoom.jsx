import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { Video, Mic, MicOff, VideoOff, Send, Users, MessageSquare, LogOut, ShieldAlert, MonitorUp } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import VideoPlayer from './VideoPlayer';

export default function WatchPartyRoom({ roomId, video, onLeave }) {
  const { user, token } = useAuth();
  
  const socketRef = useRef(null);
  const localVideoRef = useRef(null);
  const playerRef = useRef(null); // Ref to video element inside Custom Player (via document query or callback)

  const [participants, setParticipants] = useState([]);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [hostSocketId, setHostSocketId] = useState('');
  
  // Media states
  const [cameraActive, setCameraActive] = useState(false);
  const [micActive, setMicActive] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [mediaStream, setMediaStream] = useState(null);

  // WebRTC tracking states
  const pcsRef = useRef({}); // peerId -> RTCPeerConnection
  const [peerStreams, setPeerStreams] = useState({}); // peerId -> MediaStream

  // Tab state (chat vs participants)
  const [activeTab, setActiveTab] = useState('chat');

  // Create WebRTC peer connection
  const createPeerConnection = (peerSocketId) => {
    if (pcsRef.current[peerSocketId]) return pcsRef.current[peerSocketId];

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    pcsRef.current[peerSocketId] = pc;

    // Relaying ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit('webrtc-signal', {
          roomId,
          targetSocketId: peerSocketId,
          signal: { candidate: event.candidate }
        });
      }
    };

    // Binding incoming stream track
    pc.ontrack = (event) => {
      console.log(`[WEBRTC] Received track from peer ${peerSocketId}`);
      setPeerStreams(prev => ({
        ...prev,
        [peerSocketId]: event.streams[0]
      }));
    };

    // If local tracks are already active, add them to the new peer connection
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => {
        pc.addTrack(track, mediaStream);
      });
    }

    return pc;
  };

  // Initialize socket connection
  useEffect(() => {
    // Establish connection to socket.io
    socketRef.current = io('http://localhost:5000', {
      auth: { token }
    });

    const socket = socketRef.current;

    // Join room
    socket.emit('join-room', {
      roomId,
      userId: user.id,
      username: user.username
    });

    // Listeners
    socket.on('role-status', ({ isHost: hostStatus }) => {
      setIsHost(hostStatus);
    });

    socket.on('room-participants', ({ hostSocketId: currentHostId, participants: list }) => {
      setHostSocketId(currentHostId);
      setParticipants(list);
      setIsHost(socket.id === currentHostId);

      // Create WebRTC Peer Connections for new remote participants
      list.forEach(p => {
        if (p.socketId !== socket.id && !pcsRef.current[p.socketId]) {
          const pc = createPeerConnection(p.socketId);
          
          // Lexicographically higher socket ID initiates SDP offer to prevent collisions
          if (socket.id > p.socketId) {
            pc.createOffer()
              .then(offer => pc.setLocalDescription(offer))
              .then(() => {
                socket.emit('webrtc-signal', {
                  roomId,
                  targetSocketId: p.socketId,
                  signal: { sdp: pc.localDescription }
                });
              })
              .catch(err => console.error('Failed to create WebRTC offer:', err));
          }
        }
      });
    });

    socket.on('webrtc-signal-client', async ({ senderSocketId, signal }) => {
      let pc = pcsRef.current[senderSocketId];
      if (!pc) {
        pc = createPeerConnection(senderSocketId);
      }

      try {
        if (signal.sdp) {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          if (signal.sdp.type === 'offer') {
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit('webrtc-signal', {
              roomId,
              targetSocketId: senderSocketId,
              signal: { sdp: pc.localDescription }
            });
          }
        } else if (signal.candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
        }
      } catch (err) {
        console.error('WebRTC signaling error:', err);
      }
    });

    socket.on('chat-message-client', (msg) => {
      setMessages(prev => [...prev, msg]);
      setTimeout(() => {
        const chatContainer = document.getElementById('chat-scroll');
        if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;
      }, 50);
    });

    // Sync instructions from host
    socket.on('video-sync-client', ({ playing, currentTime, timestamp }) => {
      const videoEl = document.querySelector('video');
      if (!videoEl) return;

      const latency = (Date.now() - timestamp) / 1000;
      const targetTime = currentTime + (playing ? latency : 0);

      if (Math.abs(videoEl.currentTime - targetTime) > 1.2) {
        videoEl.currentTime = targetTime;
      }

      if (playing && videoEl.paused) {
        videoEl.play().catch(() => {});
      } else if (!playing && !videoEl.paused) {
        videoEl.pause();
      }
    });

    return () => {
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
      }
      Object.values(pcsRef.current).forEach(pc => pc.close());
      socket.disconnect();
    };
  }, [roomId, token, mediaStream]);

  // Webcam permission activation with robust triggers and user prompts
  const toggleCamera = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert('Insecure Context or Unsupported Browser: WebRTC Media Capture requires a secure origin (HTTPS or localhost).');
      return;
    }

    try {
      if (cameraActive) {
        if (mediaStream) {
          mediaStream.getVideoTracks().forEach(track => track.stop());
        }
        setCameraActive(false);
        // Clear video element with proper cleanup
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = null;
          localVideoRef.current.load();
        }
        socketRef.current.emit('media-toggle', { roomId, cameraActive: false });
      } else {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: 'user'
          },
          audio: false // audio is toggled by mic controls separately
        });
        
        setMediaStream(prev => {
          if (prev) {
            // Merge streams if mic was active
            stream.getVideoTracks().forEach(t => prev.addTrack(t));
            return prev;
          }
          return stream;
        });

        setCameraActive(true);

        // Bind target reference with proper lifecycle handling
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          // Ensure video element properties are set for autoplay
          localVideoRef.current.autoplay = true;
          localVideoRef.current.playsInline = true;
          localVideoRef.current.muted = true;
          // Force play to bypass browser autoplay policies
          localVideoRef.current.play().catch(err => {
            console.warn('Autoplay blocked, user interaction required:', err);
          });
        }

        socketRef.current.emit('media-toggle', { roomId, cameraActive: true });

        // Add track to existing WebRTC peer connections
        const videoTrack = stream.getVideoTracks()[0];
        Object.values(pcsRef.current).forEach(pc => {
          const senders = pc.getSenders();
          const videoSender = senders.find(s => s.track && s.track.kind === 'video');
          if (videoSender) {
            videoSender.replaceTrack(videoTrack);
          } else {
            pc.addTrack(videoTrack, stream);
          }
        });
      }
    } catch (err) {
      console.error('Camera capture failed:', err);
      if (err.name === 'NotAllowedError') {
        alert('Permission Denied: Camera access was blocked by user. Please reset permissions in your browser bar and refresh the page.');
      } else if (err.name === 'NotFoundError') {
        alert('Hardware Error: Camera device was not found on your system. Please ensure a camera is connected.');
      } else if (err.name === 'NotReadableError') {
        alert('Hardware Error: Camera is already in use by another application.');
      } else if (err.name === 'OverconstrainedError') {
        alert('Hardware Error: Camera does not support the requested constraints.');
      } else {
        alert(`Failed to activate camera: ${err.message}`);
      }
    }
  };

  const toggleMic = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert('Insecure Context or Unsupported Browser: WebRTC Media Capture requires a secure origin (HTTPS or localhost).');
      return;
    }

    try {
      if (micActive) {
        if (mediaStream) {
          mediaStream.getAudioTracks().forEach(track => track.stop());
        }
        setMicActive(false);
        socketRef.current.emit('media-toggle', { roomId, micActive: false });
      } else {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
        
        setMediaStream(prev => {
          if (prev) {
            stream.getAudioTracks().forEach(t => prev.addTrack(t));
            return prev;
          }
          return stream;
        });

        setMicActive(true);
        socketRef.current.emit('media-toggle', { roomId, micActive: true });

        // Add track to peers
        const audioTrack = stream.getAudioTracks()[0];
        Object.values(pcsRef.current).forEach(pc => {
          const senders = pc.getSenders();
          const audioSender = senders.find(s => s.track && s.track.kind === 'audio');
          if (audioSender) {
            audioSender.replaceTrack(audioTrack);
          } else {
            pc.addTrack(audioTrack, stream);
          }
        });
      }
    } catch (err) {
      console.error('Microphone capture failed:', err);
      if (err.name === 'NotAllowedError') {
        alert('Permission Denied: Microphone access was blocked by user. Please reset permissions in your browser bar and refresh the page.');
      } else if (err.name === 'NotFoundError') {
        alert('Hardware Error: Microphone device was not found on your system. Please ensure a microphone is connected.');
      } else if (err.name === 'NotReadableError') {
        alert('Hardware Error: Microphone is already in use by another application.');
      } else {
        alert(`Failed to activate microphone: ${err.message}`);
      }
    }
  };

  const toggleScreenShare = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      alert('Screen sharing is not supported in this browser.');
      return;
    }

    try {
      if (screenSharing) {
        // Stop screen sharing
        if (mediaStream) {
          const screenTrack = mediaStream.getVideoTracks().find(track => track.label.includes('screen'));
          if (screenTrack) {
            screenTrack.stop();
            // Remove from all peer connections
            Object.values(pcsRef.current).forEach(pc => {
              const senders = pc.getSenders();
              const videoSender = senders.find(s => s.track && s.track.kind === 'video' && s.track.label.includes('screen'));
              if (videoSender) {
                pc.removeTrack(videoSender);
              }
            });
          }
        }
        setScreenSharing(false);
        socketRef.current.emit('media-toggle', { roomId, screenSharing: false });
      } else {
        // Start screen sharing
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            cursor: 'always'
          },
          audio: false
        });

        // Handle user clicking stop sharing in browser UI
        stream.getVideoTracks()[0].onended = () => {
          setScreenSharing(false);
          socketRef.current.emit('media-toggle', { roomId, screenSharing: false });
        };

        setMediaStream(prev => {
          if (prev) {
            stream.getVideoTracks().forEach(t => prev.addTrack(t));
            return prev;
          }
          return stream;
        });

        setScreenSharing(true);
        socketRef.current.emit('media-toggle', { roomId, screenSharing: true });

        // Add screen track to peers
        const screenTrack = stream.getVideoTracks()[0];
        Object.values(pcsRef.current).forEach(pc => {
          const senders = pc.getSenders();
          const videoSender = senders.find(s => s.track && s.track.kind === 'video');
          if (videoSender) {
            videoSender.replaceTrack(screenTrack);
          } else {
            pc.addTrack(screenTrack, stream);
          }
        });
      }
    } catch (err) {
      console.error('Screen share failed:', err);
      if (err.name === 'NotAllowedError') {
        alert('Permission Denied: Screen sharing was cancelled.');
      } else {
        alert(`Failed to share screen: ${err.message}`);
      }
    }
  };

  // Sync actions mapped to socket
  const handleHostPlay = (time) => {
    if (!isHost) return;
    socketRef.current.emit('video-sync', { roomId, playing: true, currentTime: time });
  };

  const handleHostPause = (time) => {
    if (!isHost) return;
    socketRef.current.emit('video-sync', { roomId, playing: false, currentTime: time });
  };

  const handleHostSeek = (time) => {
    if (!isHost) return;
    socketRef.current.emit('video-sync', { roomId, playing: false, currentTime: time });
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    socketRef.current.emit('chat-message', {
      roomId,
      message: newMessage,
      username: user.username,
      userPlan: user.subscriptionPlan
    });

    setNewMessage('');
  };

  // Render plan badges in chat
  const getPlanBadgeClass = (plan) => {
    switch (plan) {
      case 'Gold': return 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border border-yellow-500/30';
      case 'Silver': return 'bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/30';
      case 'Bronze': return 'bg-amber-600/20 text-amber-700 dark:text-amber-500 border border-amber-600/30';
      default: return 'bg-slate-500/10 text-slate-500 dark:text-slate-400 border border-slate-500/20';
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 p-4 lg:p-6 bg-slate-50 dark:bg-slate-850 rounded-2xl border border-slate-200 dark:border-slate-850">
      
      {/* Left Column: Custom Video Player & Webcam Grid */}
      <div className="lg:col-span-3 flex flex-col gap-6">
        
        {/* Custom Video Player wrapper */}
        <VideoPlayer
          src={video.url}
          title={video.title}
          isWatchParty={true}
          roleIsHost={isHost}
          onPlayCallback={handleHostPlay}
          onPauseCallback={handleHostPause}
          onSeekCallback={handleHostSeek}
          onTimeUpdateCallback={(time) => {
            // Can be used for host metrics / intervals
          }}
        />

        {/* WebRTC Video Call Frame Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {/* Local User Stream */}
          <div className="relative aspect-video bg-slate-900 rounded-xl overflow-hidden border border-slate-700 shadow-md">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover scale-x-[-1] ${cameraActive ? 'block' : 'hidden'}`}
            />
            {!cameraActive && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500">
                <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center mb-2">
                  <VideoOff className="w-5 h-5 text-slate-400" />
                </div>
                <span className="text-xs font-semibold">Camera Off</span>
              </div>
            )}
            <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] text-white flex items-center gap-1">
              <span>You ({user.username})</span>
              {micActive ? <Mic className="w-3 h-3 text-green-400" /> : <MicOff className="w-3 h-3 text-red-400" />}
            </div>
          </div>

          {/* Remote Streams (Real Peer connections rendering live WebRTC streams) */}
          {participants.filter(p => p.socketId !== socketRef.current?.id).map((p, idx) => {
            const hasStream = peerStreams[p.socketId];
            return (
              <div key={p.socketId} className="relative aspect-video bg-slate-900 rounded-xl overflow-hidden border border-slate-700 shadow-md animate-fade-in">
                <video
                  autoPlay
                  playsInline
                  muted={false}
                  ref={(el) => {
                    if (el && hasStream) {
                      el.srcObject = hasStream;
                      el.autoplay = true;
                      el.playsInline = true;
                      el.play().catch(err => {
                        console.warn('Remote stream autoplay blocked:', err);
                      });
                    }
                  }}
                  className={`w-full h-full object-cover ${p.cameraActive && hasStream ? 'block' : 'hidden'}`}
                />
                
                {(!p.cameraActive || !hasStream) && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500">
                    <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center mb-2 text-slate-300 font-bold uppercase">
                      {p.username[0]}
                    </div>
                    <span className="text-xs">{p.username}</span>
                  </div>
                )}
                <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] text-white flex items-center gap-1">
                  <span>{p.username}</span>
                  {p.micActive ? <Mic className="w-3 h-3 text-green-400" /> : <MicOff className="w-3 h-3 text-red-400" />}
                </div>
              </div>
            );
          })}

          {/* Empty stream slots placeholder if single */}
          {participants.length < 4 && Array.from({ length: 4 - participants.length }).map((_, i) => (
            <div key={`empty-${i}`} className="hidden sm:flex border border-dashed border-slate-300 dark:border-slate-700 aspect-video rounded-xl items-center justify-center text-slate-400 text-xs">
              Waiting for friends...
            </div>
          ))}
        </div>

        {/* Video Call Controls */}
        <div className="flex flex-wrap items-center justify-center gap-4 bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
          <button
            onClick={toggleCamera}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
              cameraActive ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100'
            }`}
          >
            {cameraActive ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
            <span>Camera {cameraActive ? 'Off' : 'On'}</span>
          </button>

          <button
            onClick={toggleMic}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
              micActive ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100'
            }`}
          >
            {micActive ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            <span>Mic {micActive ? 'Mute' : 'Unmute'}</span>
          </button>

          <button
            onClick={toggleScreenShare}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
              screenSharing ? 'bg-brand-500 text-white' : 'bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100'
            }`}
          >
            <MonitorUp className="w-4 h-4" />
            <span>{screenSharing ? 'Stop Sharing' : 'Share Screen'}</span>
          </button>

          <button
            onClick={onLeave}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-medium transition-all ml-auto"
          >
            <LogOut className="w-4 h-4" />
            <span>Leave Party</span>
          </button>
        </div>
      </div>

      {/* Right Column: Chat & Room Details Sidebar */}
      <div className="lg:col-span-1 flex flex-col h-[500px] lg:h-auto min-h-[450px] bg-white dark:bg-slate-800 rounded-xl overflow-hidden shadow-sm border border-slate-200 dark:border-slate-800">
        
        {/* Header tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900">
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-2 border-b-2 transition-all ${
              activeTab === 'chat' ? 'border-brand-500 text-brand-600 dark:text-brand-400 bg-white dark:bg-slate-800' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Chat ({messages.length})</span>
          </button>
          
          <button
            onClick={() => setActiveTab('participants')}
            className={`flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-2 border-b-2 transition-all ${
              activeTab === 'participants' ? 'border-brand-500 text-brand-600 dark:text-brand-400 bg-white dark:bg-slate-800' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>People ({participants.length})</span>
          </button>
        </div>

        {/* Tab body content */}
        <div className="flex-1 flex flex-col p-4 overflow-hidden">
          {activeTab === 'chat' ? (
            <>
              {/* Chat messages */}
              <div 
                id="chat-scroll"
                className="flex-1 overflow-y-auto pr-1 flex flex-col gap-3 mb-4 scroll-smooth"
              >
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs text-center p-4">
                    <MessageSquare className="w-8 h-8 text-slate-300 mb-2" />
                    <span>Watch party started! Post a message to group chat.</span>
                  </div>
                ) : (
                  messages.map(msg => (
                    <div key={msg.id} className="flex flex-col gap-1 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-800 dark:text-slate-100">{msg.username}</span>
                        <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold uppercase tracking-wider ${getPlanBadgeClass(msg.userPlan)}`}>
                          {msg.userPlan}
                        </span>
                        <span className="text-[9px] text-slate-400 ml-auto">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="bg-slate-100 dark:bg-slate-900 p-2 rounded-lg text-slate-700 dark:text-slate-300 break-words border border-slate-100 dark:border-slate-900">
                        {msg.message}
                      </p>
                    </div>
                  ))
                )}
              </div>

              {/* Chat Input form */}
              <form onSubmit={handleSendMessage} className="flex gap-2 mt-auto">
                <input
                  type="text"
                  placeholder="Message the room..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="flex-1 px-3 py-2 text-xs bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
                <button type="submit" className="p-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 active:scale-95 transition-all">
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </>
          ) : (
            /* Participant list tab */
            <div className="flex-grow overflow-y-auto flex flex-col gap-3">
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">
                Room Members
              </div>
              
              {participants.map(p => (
                <div key={p.socketId} className="flex items-center gap-3 p-2 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-850">
                  <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center text-white text-xs font-bold uppercase shadow-sm">
                    {p.username[0]}
                  </div>
                  
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                      {p.username}
                      {p.socketId === hostSocketId && <span className="text-[8px] bg-red-100 text-red-600 px-1 py-0.2 rounded border border-red-200 font-extrabold uppercase">Host</span>}
                    </span>
                    <span className="text-[9px] text-slate-500 dark:text-slate-400 capitalize">
                      {p.socketId === socketRef.current?.id ? 'Local Participant' : 'Remote Peer'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 ml-auto">
                    {p.cameraActive ? <Video className="w-3.5 h-3.5 text-green-500" /> : <VideoOff className="w-3.5 h-3.5 text-slate-400" />}
                    {p.micActive ? <Mic className="w-3.5 h-3.5 text-green-500" /> : <MicOff className="w-3.5 h-3.5 text-slate-400" />}
                  </div>
                </div>
              ))}
              
              {/* Host Control Explainer info box */}
              {isHost && (
                <div className="mt-auto bg-red-500/5 dark:bg-red-500/10 border border-red-500/10 p-3 rounded-lg flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <div className="text-[10px] text-red-700 dark:text-red-300">
                    <span className="font-bold">Host Permission:</span> Any interactions you trigger on the video player (play, pause, seek) will instantly reflect across all other room members' screens.
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
