
'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { VideoCall } from '@/components/video-call';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Info, Play, MonitorPlay } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function LecturerLivePage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params.courseId as string;
  const [joined, setJoined] = useState(false);
  const { user } = useAuth();

  const channelName = `course-${courseId}`;

  const handleLeave = () => {
    setJoined(false);
    router.back();
  };

  return (
    <div className="space-y-6 h-[calc(100vh-160px)] flex flex-col">
      <div className="flex items-center justify-between shrink-0">
        <Button variant="ghost" onClick={() => router.back()} className="gap-2">
          <ChevronLeft className="h-4 w-4" /> Back to Dashboard
        </Button>
        <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 animate-pulse font-bold uppercase tracking-widest text-[10px]">Host Mode</Badge>
        </div>
      </div>

      {!joined ? (
        <Card className="flex-1 flex flex-col items-center justify-center text-center">
          <CardHeader>
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <MonitorPlay className="h-10 w-10 text-primary" />
            </div>
            <CardTitle className="text-3xl font-headline">Virtual Classroom</CardTitle>
            <CardDescription className="max-w-md mx-auto">
              You are about to start a live video session for this course. Ensure your camera and microphone are ready.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Alert className="bg-muted/50 max-w-sm">
                <Info className="h-4 w-4" />
                <AlertTitle>Browser Permissions</AlertTitle>
                <AlertDescription>Your browser will ask for camera and microphone access when you click start.</AlertDescription>
            </Alert>
            <Button size="lg" className="w-full h-16 text-xl font-bold gap-3 shadow-xl" onClick={() => setJoined(true)}>
              <Play className="fill-current" /> Start Live Session
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="flex-1 min-h-0">
          <VideoCall channelName={channelName} onLeave={handleLeave} />
        </div>
      )}
    </div>
  );
}
