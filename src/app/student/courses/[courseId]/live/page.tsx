
'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { VideoCall } from '@/components/video-call';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Info, Play, Video } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

export default function StudentLivePage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params.courseId as string;
  const [joined, setJoined] = useState(false);

  const channelName = `course-${courseId}`;

  const handleLeave = () => {
    setJoined(false);
    router.back();
  };

  return (
    <div className="space-y-6 h-[calc(100vh-160px)] flex flex-col">
      <div className="flex items-center justify-between shrink-0">
        <Button variant="ghost" onClick={() => router.back()} className="gap-2">
          <ChevronLeft className="h-4 w-4" /> Back to Course
        </Button>
        <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 font-bold uppercase tracking-widest text-[10px]">Live Session</Badge>
        </div>
      </div>

      {!joined ? (
        <Card className="flex-1 flex flex-col items-center justify-center text-center">
          <CardHeader>
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Video className="h-10 w-10 text-primary" />
            </div>
            <CardTitle className="text-3xl font-headline">Join Class Session</CardTitle>
            <CardDescription className="max-w-md mx-auto">
              A live session is taking place. Click the button below to join your lecturer and classmates.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Alert className="bg-muted/50 max-w-sm text-left">
                <Info className="h-4 w-4" />
                <AlertTitle>Participation Tips</AlertTitle>
                <AlertDescription>Keep your mic muted unless speaking to reduce background noise.</AlertDescription>
            </Alert>
            <Button size="lg" className="w-full h-16 text-xl font-bold gap-3 shadow-xl" onClick={() => setJoined(true)}>
              <Play className="fill-current" /> Join Now
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
