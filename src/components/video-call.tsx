
'use client';

import React, { useEffect, useState } from 'react';
import AgoraRTC from 'agora-rtc-sdk-ng';
import {
  AgoraRTCProvider,
  useJoin,
  useLocalCameraTrack,
  useLocalMicrophoneTrack,
  usePublish,
  useRemoteAudioTracks,
  useRemoteUsers,
  RemoteUser,
  LocalVideoTrack,
} from 'agora-rtc-react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Users, Loader2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

const AGORA_APP_ID = process.env.NEXT_PUBLIC_AGORA_APP_ID || '';

function VideoCallUI({ channelName, onLeave }: { channelName: string; onLeave: () => void }) {
  const [micOn, setMic] = useState(true);
  const [videoOn, setVideo] = useState(true);
  const { localMicrophoneTrack } = useLocalMicrophoneTrack(micOn);
  const { localCameraTrack } = useLocalCameraTrack(videoOn);
  const remoteUsers = useRemoteUsers();
  const { audioTracks } = useRemoteAudioTracks(remoteUsers);

  // Play remote audio
  audioTracks.forEach((track) => track.play());

  // Join the channel
  useJoin({
    appid: AGORA_APP_ID,
    channel: channelName,
    token: null, // Use null for testing with app in testing mode
  });

  // Publish tracks
  usePublish([localMicrophoneTrack, localCameraTrack]);

  return (
    <div className="flex flex-col h-full bg-slate-900 rounded-lg overflow-hidden text-white relative">
      {/* Grid of users */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 overflow-auto min-h-0">
        <div className="relative aspect-video bg-slate-800 rounded-lg border border-slate-700 overflow-hidden group">
          <LocalVideoTrack
            track={localCameraTrack}
            play={true}
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-2 left-2 bg-black/50 px-2 py-1 rounded text-xs">
            You
          </div>
          {!videoOn && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-800">
              <div className="w-16 h-16 rounded-full bg-slate-700 flex items-center justify-center text-2xl font-bold">
                Y
              </div>
            </div>
          )}
        </div>

        {remoteUsers.map((user) => (
          <div key={user.uid} className="relative aspect-video bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
            <RemoteUser user={user} className="w-full h-full object-cover" />
            <div className="absolute bottom-2 left-2 bg-black/50 px-2 py-1 rounded text-xs">
              Participant {user.uid}
            </div>
          </div>
        ))}
      </div>

      {/* Control Bar */}
      <div className="bg-slate-950 p-4 flex items-center justify-center gap-4 border-t border-slate-800 shadow-2xl">
        <Button
          variant="outline"
          size="icon"
          className={cn(
            "rounded-full w-12 h-12 transition-all",
            micOn ? "bg-slate-800 border-slate-700" : "bg-destructive text-white hover:bg-destructive/90 border-destructive"
          )}
          onClick={() => setMic((prev) => !prev)}
        >
          {micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
        </Button>

        <Button
          variant="outline"
          size="icon"
          className={cn(
            "rounded-full w-12 h-12 transition-all",
            videoOn ? "bg-slate-800 border-slate-700" : "bg-destructive text-white hover:bg-destructive/90 border-destructive"
          )}
          onClick={() => setVideo((prev) => !prev)}
        >
          {videoOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
        </Button>

        <Button
          variant="destructive"
          size="icon"
          className="rounded-full w-12 h-12 shadow-lg animate-pulse hover:animate-none"
          onClick={onLeave}
        >
          <PhoneOff className="h-5 w-5" />
        </Button>

        <div className="absolute right-6 hidden sm:flex items-center gap-4">
            <div className="flex items-center gap-2 text-slate-400">
                <Users className="h-4 w-4"/>
                <span className="text-xs font-bold">{remoteUsers.length + 1} online</span>
            </div>
        </div>
      </div>
    </div>
  );
}

export function VideoCall({ channelName, onLeave }: { channelName: string; onLeave: () => void }) {
  const [client, setClient] = useState<any>(null);

  useEffect(() => {
    const agoraClient = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
    setClient(agoraClient);
  }, []);

  if (!AGORA_APP_ID) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Missing API Configuration</AlertTitle>
        <AlertDescription>
          Agora App ID is not configured. Please set NEXT_PUBLIC_AGORA_APP_ID in your environment settings.
        </AlertDescription>
      </Alert>
    );
  }

  if (!client) {
    return (
      <div className="flex h-96 w-full items-center justify-center bg-slate-900 rounded-lg border">
        <div className="flex flex-col items-center gap-4 text-slate-400">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm font-bold uppercase tracking-widest">Initializing Video Bridge...</p>
        </div>
      </div>
    );
  }

  return (
    <AgoraRTCProvider client={client}>
      <VideoCallUI channelName={channelName} onLeave={onLeave} />
    </AgoraRTCProvider>
  );
}
