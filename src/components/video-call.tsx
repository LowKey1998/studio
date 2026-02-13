'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Loader2, MessageSquare, Send, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { db } from '@/lib/firebase';
import { ref, push, set, onValue, serverTimestamp, onChildAdded, update, onDisconnect, off, onChildRemoved } from 'firebase/database';
import { useAuth } from '@/hooks/use-auth';
import { ScrollArea } from './ui/scroll-area';
import { Input } from './ui/input';
import { format } from 'date-fns';

type Message = {
    id: string;
    senderName: string;
    content: string;
    timestamp: number;
}

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

export function VideoCall({ channelName, onLeave }: { channelName: string; onLeave: () => void }) {
  const { user, userProfile } = useAuth();
  const [micOn, setMic] = useState(true);
  const [videoOn, setVideo] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [isHost, setIsHost] = useState(false);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnections = useRef<Record<string, RTCPeerConnection>>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  // 1. Determine Role
  useEffect(() => {
    if (!user || !channelName) return;
    const sessionRef = ref(db, `liveSessions/${channelName}/startedBy`);
    return onValue(sessionRef, (snap) => {
        setIsHost(snap.val() === user.uid);
    });
  }, [user, channelName]);

  // 2. Initialize Media
  useEffect(() => {
    let stream: MediaStream;
    async function startMedia() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        setLocalStream(stream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        
        if (user) {
            const presenceRef = ref(db, `liveSessions/${channelName}/participants/${user.uid}`);
            set(presenceRef, { 
                name: userProfile?.name || 'User', 
                joinedAt: serverTimestamp(),
                role: isHost ? 'host' : 'student'
            });
            onDisconnect(presenceRef).remove();
        }
      } catch (err) {
        console.error("Error accessing media devices:", err);
      }
    }
    startMedia();

    return () => {
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
    };
  }, [user, userProfile, channelName, isHost]);

  // 3. Signaling & Connection Logic
  useEffect(() => {
    if (!user || !localStream || !channelName) return;

    const createPC = (targetId: string) => {
      const pc = new RTCPeerConnection(ICE_SERVERS);

      localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
      });

      pc.ontrack = (event) => {
        setRemoteStreams(prev => ({
          ...prev,
          [targetId]: event.streams[0]
        }));
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          const path = isHost ? `${targetId}/candidates/host` : `${user.uid}/candidates/participant`;
          const candRef = push(ref(db, `liveSessions/${channelName}/signaling/${path}`));
          set(candRef, event.candidate.toJSON());
        }
      };

      pc.onconnectionstatechange = () => {
          if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
              setRemoteStreams(prev => {
                  const next = { ...prev };
                  delete next[targetId];
                  return next;
              });
          }
      };

      // Listen for remote ICE candidates
      const remotePath = isHost ? `${targetId}/candidates/participant` : `${user.uid}/candidates/host`;
      const remoteCandRef = ref(db, `liveSessions/${channelName}/signaling/${remotePath}`);
      onChildAdded(remoteCandRef, (snap) => {
          if (snap.exists()) {
              pc.addIceCandidate(new RTCIceCandidate(snap.val())).catch(e => console.error("ICE error", e));
          }
      });

      peerConnections.current[targetId] = pc;
      return pc;
    };

    if (isHost) {
      const participantsRef = ref(db, `liveSessions/${channelName}/participants`);
      const unsubAdded = onChildAdded(participantsRef, async (snap) => {
        const participantId = snap.key;
        if (!participantId || participantId === user.uid) return;

        const pc = createPC(participantId);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        await set(ref(db, `liveSessions/${channelName}/signaling/${participantId}/offer`), {
          type: offer.type,
          sdp: offer.sdp,
          from: user.uid
        });

        const answerRef = ref(db, `liveSessions/${channelName}/signaling/${participantId}/answer`);
        onValue(answerRef, async (ansSnap) => {
            if (ansSnap.exists()) {
                const answer = ansSnap.val();
                if (pc.signalingState !== 'stable') {
                    await pc.setRemoteDescription(new RTCSessionDescription(answer));
                }
            }
        });
      });

      const unsubRemoved = onChildRemoved(participantsRef, (snap) => {
          const participantId = snap.key;
          if (participantId && peerConnections.current[participantId]) {
              peerConnections.current[participantId].close();
              delete peerConnections.current[participantId];
              setRemoteStreams(prev => {
                  const next = { ...prev };
                  delete next[participantId];
                  return next;
              });
          }
      });

      return () => {
          off(participantsRef);
          unsubAdded();
          unsubRemoved();
      };
    } else {
      const mySignalingRef = ref(db, `liveSessions/${channelName}/signaling/${user.uid}/offer`);
      const unsubOffer = onValue(mySignalingRef, async (snap) => {
        if (!snap.exists()) return;
        
        const offer = snap.val();
        const hostId = offer.from;
        
        const pc = createPC(hostId);
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        await set(ref(db, `liveSessions/${channelName}/signaling/${user.uid}/answer`), {
          type: answer.type,
          sdp: answer.sdp,
        });
      });

      return () => {
          off(mySignalingRef);
          unsubOffer();
      };
    }
  }, [user, isHost, channelName, localStream]);

  // 4. Chat logic
  useEffect(() => {
      if (!channelName) return;
      const messagesRef = ref(db, `liveSessions/${channelName}/messages`);
      return onValue(messagesRef, (snapshot) => {
          if (snapshot.exists()) {
              const data = snapshot.val();
              const list = Object.entries(data).map(([id, msg]: [string, any]) => ({ id, ...msg }));
              setMessages(list.sort((a,b) => a.timestamp - b.timestamp));
          }
      });
  }, [channelName]);

  useEffect(() => {
      if (scrollRef.current) {
          scrollRef.current.scrollIntoView({ behavior: 'smooth' });
      }
  }, [messages, showChat]);

  const handleSendMessage = async (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      if (!chatMessage.trim() || !userProfile) return;

      const messagesRef = ref(db, `liveSessions/${channelName}/messages`);
      await push(messagesRef, {
          senderName: userProfile.name,
          content: chatMessage,
          timestamp: serverTimestamp()
      });
      setChatMessage('');
  };

  const toggleMic = () => {
    if (localStream) {
        localStream.getAudioTracks().forEach(t => t.enabled = !micOn);
        setMic(!micOn);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
        localStream.getVideoTracks().forEach(t => t.enabled = !videoOn);
        setVideo(!videoOn);
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-full bg-slate-950 rounded-2xl overflow-hidden text-white relative border border-white/5 shadow-2xl">
      <div className="flex-1 flex flex-col relative min-h-0 bg-slate-900/50">
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6 overflow-auto">
            <div className="relative aspect-video bg-slate-800 rounded-2xl border border-white/5 overflow-hidden shadow-2xl group">
                <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover scale-x-[-1]"
                />
                <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-xl px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border border-white/10 shadow-lg">
                    You {isHost && "(Host)"}
                </div>
                {!videoOn && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-800/95 backdrop-blur-sm">
                        <div className="w-20 h-20 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-3xl font-black text-primary">
                            {userProfile?.name?.charAt(0)}
                        </div>
                    </div>
                )}
            </div>

            {Object.entries(remoteStreams).map(([uid, stream]) => (
                <RemoteVideo key={uid} stream={stream} label={isHost ? `Student ${uid.slice(-4)}` : "Lecturer"} />
            ))}
        </div>

        <div className="p-8 flex items-center justify-center gap-6 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent">
            <Button
                variant="outline"
                size="icon"
                className={cn(
                    "rounded-full w-14 h-14 transition-all hover:scale-110 active:scale-95 border-2 shadow-xl",
                    micOn ? "bg-slate-800/50 border-white/10 text-white hover:bg-slate-700" : "bg-destructive text-white hover:bg-destructive/90 border-destructive"
                )}
                onClick={toggleMic}
            >
                {micOn ? <Mic className="h-6 w-6" /> : <MicOff className="h-6 w-6" />}
            </Button>

            <Button
                variant="outline"
                size="icon"
                className={cn(
                    "rounded-full w-14 h-14 transition-all hover:scale-110 active:scale-95 border-2 shadow-xl",
                    videoOn ? "bg-slate-800/50 border-white/10 text-white hover:bg-slate-700" : "bg-destructive text-white hover:bg-destructive/90 border-destructive"
                )}
                onClick={toggleVideo}
            >
                {videoOn ? <Video className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />}
            </Button>

            <Button
                variant="outline"
                size="icon"
                className={cn(
                    "rounded-full w-14 h-14 transition-all hover:scale-110 active:scale-95 border-2 shadow-xl",
                    showChat ? "bg-primary text-primary-foreground border-primary" : "bg-slate-800/50 border-white/10 text-white"
                )}
                onClick={() => setShowChat(!showChat)}
            >
                <MessageSquare className="h-6 w-6" />
            </Button>

            <Button
                variant="destructive"
                size="icon"
                className="rounded-full w-14 h-14 shadow-2xl hover:scale-110 active:scale-95 border-2 border-white/10"
                onClick={onLeave}
            >
                <PhoneOff className="h-6 w-6" />
            </Button>
        </div>
      </div>

      {showChat && (
          <div className="w-full md:w-96 bg-slate-950/95 backdrop-blur-2xl border-l border-white/10 flex flex-col animate-in slide-in-from-right duration-500 ease-out shadow-2xl">
              <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/5">
                  <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/20">
                        <MessageSquare className="h-4 w-4 text-primary" />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Class Discussion</span>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/10" onClick={() => setShowChat(false)}>
                      <X className="h-4 w-4" />
                  </Button>
              </div>
              <ScrollArea className="flex-1 p-6">
                  <div className="space-y-6">
                      {messages.map((msg) => (
                          <div key={msg.id} className={cn("flex flex-col gap-2", msg.senderName === userProfile?.name ? "items-end" : "items-start")}>
                              <div className="flex items-center gap-2 px-1">
                                  <span className="text-[9px] font-black uppercase tracking-wider opacity-40">{msg.senderName}</span>
                                  <span className="text-[8px] opacity-20 font-mono">{msg.timestamp ? format(new Date(msg.timestamp), 'HH:mm') : ''}</span>
                              </div>
                              <div className={cn("px-4 py-2.5 rounded-2xl text-sm max-w-[90%] break-words shadow-lg leading-relaxed", msg.senderName === userProfile?.name ? "bg-primary text-primary-foreground rounded-tr-none" : "bg-slate-800/80 rounded-tl-none border border-white/5")}>
                                  {msg.content}
                              </div>
                          </div>
                      ))}
                      <div ref={scrollRef} />
                  </div>
              </ScrollArea>
              <form onSubmit={handleSendMessage} className="p-6 border-t border-white/10 bg-white/5 flex items-center gap-3">
                  <Input 
                    value={chatMessage} 
                    onChange={e => setChatMessage(e.target.value)} 
                    placeholder="Contribute to discussion..." 
                    className="bg-slate-900/50 border-white/10 h-11 text-xs focus-visible:ring-primary text-white rounded-xl"
                  />
                  <Button type="submit" size="icon" className="h-11 w-11 shrink-0 rounded-xl shadow-xl active:scale-95 transition-transform" disabled={!chatMessage.trim()}>
                      <Send className="h-4 w-4" />
                  </Button>
              </form>
          </div>
      )}
    </div>
  );
}

function RemoteVideo({ stream, label }: { stream: MediaStream; label: string }) {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
        }
    }, [stream]);

    return (
        <div className="relative aspect-video bg-slate-800 rounded-2xl border border-white/5 overflow-hidden shadow-2xl transition-all hover:scale-[1.02]">
            <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
            />
            <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-xl px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border border-white/10 shadow-lg">
                {label}
            </div>
        </div>
    );
}