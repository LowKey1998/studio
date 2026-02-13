
'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { VideoCall } from '@/components/video-call';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Info, Play, MonitorPlay, Power, Loader2, Clock, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { db } from '@/lib/firebase';
import { ref, onValue, set, update, get } from 'firebase/database';
import { format } from 'date-fns';
import Link from 'next/link';

const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function LecturerLivePage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params.courseId as string;
  const [sessionActive, setSessionActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isLiveTimetableDay, setIsLiveTimetableDay] = useState(false);
  const [autoStartTime, setAutoStartTime] = useState<string | null>(null);
  const { user } = useAuth();

  const channelName = `course-${courseId}`;

  useEffect(() => {
      if (!courseId) return;
      
      const sessionRef = ref(db, `liveSessions/${channelName}/status`);
      const unsub = onValue(sessionRef, (snap) => {
          setSessionActive(snap.val() === 'active');
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
      return () => unsub();
  }, [courseId, channelName]);

  const handleStartSession = async () => {
      const sessionRef = ref(db, `liveSessions/${channelName}`);
      await update(sessionRef, {
          status: 'active',
          startedAt: Date.now(),
          startedBy: user?.uid
      });
  };

  const handleEndSession = async () => {
      if(!confirm("Are you sure you want to end this live session for everyone?")) return;
      const sessionRef = ref(db, `liveSessions/${channelName}`);
      await update(sessionRef, {
          status: 'ended',
          endedAt: Date.now()
      });
      setSessionActive(false);
  };

  if (loading) return <div className="p-6 text-center"><Loader2 className="animate-spin h-8 w-8 mx-auto" /><p className="mt-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">Checking Timetable Status...</p></div>;

  if (!isLiveTimetableDay) {
      return (
          <div className="p-6 max-w-2xl mx-auto space-y-6">
              <Alert variant="destructive" className="border-2 shadow-lg">
                  <AlertTriangle className="h-5 w-5" />
                  <AlertTitle className="font-black uppercase tracking-widest">No Live Session Scheduled</AlertTitle>
                  <AlertDescription className="text-sm font-medium leading-relaxed">
                      This course instance is not marked for a live digital session today. Please consult the master timetable or contact the registrar to enable live streaming for this session.
                  </AlertDescription>
              </Alert>
              <Button variant="outline" asChild className="w-full h-12 font-bold">
                  <Link href="/staff/timetable">View My Timetable</Link>
              </Button>
          </div>
      );
  }

  return (
    <div className="space-y-6 h-[calc(100vh-160px)] flex flex-col">
      <div className="flex items-center justify-between shrink-0">
        <Button variant="ghost" onClick={() => router.back()} className="gap-2 font-bold text-xs uppercase tracking-tighter">
          <ChevronLeft className="h-4 w-4" /> Back to Course
        </Button>
        <div className="flex items-center gap-2">
            {sessionActive && <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 animate-pulse font-black uppercase tracking-widest text-[10px]">On Air</Badge>}
            <Badge variant="secondary" className="font-black text-[10px] uppercase bg-primary/10 text-primary border-primary/20">Host Mode</Badge>
        </div>
      </div>

      {!sessionActive ? (
        <Card className="flex-1 flex flex-col items-center justify-center text-center shadow-xl border-dashed border-2">
          <CardHeader>
            <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <MonitorPlay className="h-12 w-12 text-primary" />
            </div>
            <CardTitle className="text-4xl font-headline font-black uppercase tracking-tight">Virtual Classroom</CardTitle>
            <CardDescription className="max-w-md mx-auto text-base">
              Ready to begin? Starting the session will allow students to join the video bridge and participate in the real-time chat.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 w-full max-w-sm">
            {autoStartTime && (
                <div className="flex items-center justify-center gap-2 text-sm font-black text-primary uppercase tracking-widest p-4 border rounded-xl bg-primary/5">
                    <Clock className="h-4 w-4"/>
                    Scheduled for {autoStartTime}
                </div>
            )}
            <Button size="lg" className="w-full h-20 text-2xl font-black gap-3 shadow-2xl uppercase tracking-wider" onClick={handleStartSession}>
              <Play className="fill-current h-6 w-6" /> Go Live
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col gap-4">
          <div className="flex justify-end px-2">
              <Button variant="destructive" size="sm" onClick={handleEndSession} className="gap-2 font-black uppercase text-[10px] h-8 shadow-md">
                  <Power className="h-3 w-3" /> Terminate Session
              </Button>
          </div>
          <div className="flex-1 min-h-0">
            <VideoCall channelName={channelName} onLeave={handleEndSession} />
          </div>
        </div>
      )}
    </div>
  );
}
