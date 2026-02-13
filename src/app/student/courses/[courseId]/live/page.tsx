
'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { VideoCall } from '@/components/video-call';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Info, Play, Video, Loader2, AlertCircle, Clock, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { db } from '@/lib/firebase';
import { ref, onValue, get } from 'firebase/database';
import Link from 'next/link';

const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function StudentLivePage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params.courseId as string;
  const [sessionStatus, setSessionStatus] = useState<'inactive' | 'active' | 'ended'>('inactive');
  const [joined, setJoined] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isLiveTimetableDay, setIsLiveTimetableDay] = useState(false);
  const [autoStartTime, setAutoStartTime] = useState<string | null>(null);

  const channelName = `course-${courseId}`;

  useEffect(() => {
      if (!courseId) return;
      
      const sessionRef = ref(db, `liveSessions/${channelName}/status`);
      const unsubStatus = onValue(sessionRef, (snap) => {
          setSessionStatus(snap.val() || 'inactive');
      });

      const checkTimetable = async () => {
          const today = daysOfWeek[new Date().getDay()];
          const timetablesSnap = await get(ref(db, 'timetables'));
          let isLive = false;
          let startTime = null;

          if (timetablesSnap.exists()) {
              const data = timetablesSnap.val();
              for (const semId in data) {
                  if (data[semId][courseId]) {
                      const sessions = Object.values(data[semId][courseId]) as any[];
                      const todaySession = sessions.find(s => s.day === today && s.isLiveSession);
                      if (todaySession) {
                          isLive = true;
                          startTime = todaySession.startTime;
                          break;
                      }
                  }
              }
          }
          setIsLiveTimetableDay(isLive);
          setAutoStartTime(startTime);
          setLoading(false);
      };

      checkTimetable();
      return () => unsubStatus();
  }, [courseId, channelName]);

  const handleLeave = () => {
    setJoined(false);
    router.back();
  };

  if (loading) return <div className="p-12 text-center"><Loader2 className="animate-spin h-8 w-8 mx-auto text-primary" /><p className="mt-4 text-xs font-black uppercase tracking-widest text-muted-foreground">Checking Class Status...</p></div>;

  if (!isLiveTimetableDay) {
      return (
          <div className="p-6 max-w-2xl mx-auto space-y-6">
              <Alert variant="destructive" className="border-2 shadow-xl">
                  <AlertTriangle className="h-5 w-5" />
                  <AlertTitle className="font-black uppercase tracking-widest">Digital Classroom Closed</AlertTitle>
                  <AlertDescription className="text-sm font-medium leading-relaxed mt-2">
                      There is no live digital session scheduled for this course today. Please check your personalized timetable for accurate class times and venues.
                  </AlertDescription>
              </Alert>
              <Button asChild variant="outline" className="w-full h-12 font-bold shadow-sm">
                  <Link href="/student/timetable">View My Timetable</Link>
              </Button>
          </div>
      );
  }

  return (
    <div className="space-y-6 h-[calc(100vh-160px)] flex flex-col">
      <div className="flex items-center justify-between shrink-0">
        <Button variant="ghost" onClick={() => router.back()} className="gap-2 font-bold uppercase text-[10px]">
          <ChevronLeft className="h-4 w-4" /> Exit Classroom
        </Button>
        <div className="flex items-center gap-2">
            {sessionStatus === 'active' && <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 animate-pulse font-black uppercase tracking-widest text-[10px]">Live Now</Badge>}
        </div>
      </div>

      {!joined ? (
        <Card className="flex-1 flex flex-col items-center justify-center text-center shadow-xl">
          <CardHeader>
            <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Video className="h-12 w-12 text-primary" />
            </div>
            <CardTitle className="text-4xl font-headline font-black uppercase tracking-tight">Join Session</CardTitle>
            <CardDescription className="max-w-md mx-auto text-base mt-2">
              {sessionStatus === 'active' 
                ? "Your lecturer has officially started the session. You can now join the virtual bridge."
                : "The virtual classroom is synchronized but hasn't been activated by your lecturer yet."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 w-full max-w-sm">
            {autoStartTime && (
                <div className="flex items-center justify-center gap-2 text-xs font-bold text-muted-foreground p-3 border rounded-xl border-dashed">
                    <Clock className="h-4 w-4"/>
                    Session starts at {autoStartTime}
                </div>
            )}
            
            {sessionStatus === 'active' ? (
                <>
                    <Alert className="bg-primary/5 text-left border-primary/20 shadow-inner">
                        <Info className="h-4 w-4 text-primary" />
                        <AlertTitle className="text-[10px] font-black uppercase tracking-widest">Ready to Learn?</AlertTitle>
                        <AlertDescription className="text-xs leading-relaxed">Ensure your microphone is muted when entering to maintain a quiet learning environment.</AlertDescription>
                    </Alert>
                    <Button size="lg" className="w-full h-20 text-2xl font-black gap-3 shadow-2xl uppercase tracking-wider" onClick={() => setJoined(true)}>
                    <Play className="fill-current h-6 w-6" /> Join Bridge
                    </Button>
                </>
            ) : (
                <div className="p-10 border-2 border-dashed rounded-3xl bg-muted/20 flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-500">
                    <Loader2 className="h-10 w-10 animate-spin text-primary opacity-40" />
                    <div className="space-y-1">
                        <p className="text-sm font-black uppercase tracking-widest text-primary">Waiting for Host...</p>
                        <p className="text-[10px] text-muted-foreground font-medium italic">Auto-refreshing session status</p>
                    </div>
                </div>
            )}
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
