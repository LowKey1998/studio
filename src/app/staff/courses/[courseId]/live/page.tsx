
'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { VideoCall } from '@/components/video-call';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Info, Play, MonitorPlay, Power, Loader2, Clock, AlertTriangle, ClipboardCheck, Search, CheckCircle, XCircle, Save } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { db, createNotification } from '@/lib/firebase';
import { ref, onValue, set, update, get } from 'firebase/database';
import { format } from 'date-fns';
import Link from 'next/link';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type Student = { uid: string; id: string; name: string; };
type AttendanceStatus = "Present" | "Absent" | "Late" | "Excused Absence";
type AttendanceRecord = Record<string, AttendanceStatus>;

export default function LecturerLivePage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const courseId = params.courseId as string;
  const semesterIdFilter = searchParams.get('semesterId');
  
  const [sessionActive, setSessionActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isLiveTimetableDay, setIsLiveTimetableDay] = useState(false);
  const [autoStartTime, setAutoStartTime] = useState<string | null>(null);
  const [courseData, setCourseData] = useState<any>(null);
  
  // Attendance State
  const [isAttendanceOpen, setIsAttendanceOpen] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord>({});
  const [studentSearch, setStudentSearch] = useState('');
  const [savingAttendance, setSavingAttendance] = useState(false);

  const { user, userProfile } = useAuth();

  const channelName = `course-${courseId}`;

  useEffect(() => {
      if (!courseId) return;
      
      const sessionRef = ref(db, `liveSessions/${channelName}/status`);
      const unsub = onValue(sessionRef, (snap) => {
          setSessionActive(snap.val() === 'active');
      });

      const checkTimetable = async () => {
          const today = daysOfWeek[new Date().getDay()];
          const [timetablesSnap, courseSnap] = await Promise.all([
              get(ref(db, 'timetables')),
              get(ref(db, `courses/${courseId}`))
          ]);

          if (courseSnap.exists()) setCourseData(courseSnap.val());

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

  const fetchRoster = async () => {
      if (!courseId || !user) return;
      try {
          const [regsSnap, usersSnap] = await Promise.all([
              get(ref(db, 'registrations')),
              get(ref(db, 'users'))
          ]);

          const allUsers = usersSnap.val() || {};
          const allRegs = regsSnap.val() || {};
          const list: Student[] = [];

          for (const uid in allRegs) {
              const userRegs = allRegs[uid];
              const semesterIdsToCheck = (courseData?.separateInstance && semesterIdFilter) ? [semesterIdFilter] : Object.keys(userRegs);

              for (const semId of semesterIdsToCheck) {
                  const reg = userRegs[semId];
                  if (reg?.courses?.includes(courseId) && (reg.status === 'Completed' || reg.status === 'Pending Payment')) {
                      if (allUsers[uid]) list.push({ uid, id: allUsers[uid].id, name: allUsers[uid].name });
                      break;
                  }
              }
          }
          setStudents(list.sort((a,b) => a.name.localeCompare(b.name)));

          const todayStr = format(new Date(), 'yyyy-MM-dd');
          const path = (courseData?.separateInstance && semesterIdFilter) 
            ? `attendance/${courseId}_${semesterIdFilter}/${todayStr}` 
            : `attendance/${courseId}/${todayStr}`;
            
          const attSnap = await get(ref(db, path));
          if (attSnap.exists()) {
              setAttendance(attSnap.val());
          } else {
              const initial: AttendanceRecord = {};
              list.forEach(s => initial[s.uid] = 'Present');
              setAttendance(initial);
          }
      } catch (e) {
          console.error(e);
      }
  };

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

  const handleSaveAttendance = async () => {
      setSavingAttendance(true);
      try {
          const todayStr = format(new Date(), 'yyyy-MM-dd');
          const path = (courseData?.separateInstance && semesterIdFilter) 
            ? `attendance/${courseId}_${semesterIdFilter}/${todayStr}` 
            : `attendance/${courseId}/${todayStr}`;
            
          await set(ref(db, path), attendance);
          
          const promises = Object.entries(attendance).map(([uid, status]) => {
              if (status === 'Absent' || status === 'Late') {
                  return createNotification(uid, `Attendance Alert: Marked as ${status} for ${courseData?.name} today.`, `/student/courses/${courseId}/attendance`);
              }
              return Promise.resolve();
          });
          await Promise.all(promises);

          toast({ title: "Attendance Logged" });
          setIsAttendanceOpen(false);
      } catch (e) {
          toast({ variant: 'destructive', title: "Save Failed" });
      } finally {
          setSavingAttendance(false);
      }
  };

  const filteredStudents = students.filter(s => 
      s.name.toLowerCase().includes(studentSearch.toLowerCase()) || 
      s.id.toLowerCase().includes(studentSearch.toLowerCase())
  );

  const { toast } = useToast();

  if (loading) return <div className="p-12 text-center"><Loader2 className="animate-spin h-8 w-8 mx-auto text-primary" /><p className="mt-4 text-xs font-black uppercase tracking-widest text-muted-foreground">Synchronizing Classroom...</p></div>;

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
          <div className="flex justify-end gap-2 px-2">
              <Button variant="outline" size="sm" onClick={() => { fetchRoster(); setIsAttendanceOpen(true); }} className="gap-2 font-black uppercase text-[10px] h-8 shadow-md">
                  <ClipboardCheck className="h-3 w-3" /> Mark Attendance
              </Button>
              <Button variant="destructive" size="sm" onClick={handleEndSession} className="gap-2 font-black uppercase text-[10px] h-8 shadow-md">
                  <Power className="h-3 w-3" /> End Session
              </Button>
          </div>
          <div className="flex-1 min-h-0">
            <VideoCall channelName={channelName} onLeave={handleEndSession} />
          </div>
        </div>
      )}

      <Dialog open={isAttendanceOpen} onOpenChange={setIsAttendanceOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
              <DialogHeader>
                  <DialogTitle>Mark Live Session Attendance</DialogTitle>
                  <DialogDescription>Mark attendance for students enrolled in this instance for today ({format(new Date(), 'PPP')}).</DialogDescription>
              </DialogHeader>
              <div className="flex-1 overflow-hidden flex flex-col gap-4 py-4">
                  <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="Search students..." className="pl-8" value={studentSearch} onChange={e => setStudentSearch(e.target.value)} />
                  </div>
                  <div className="flex-1 overflow-auto rounded-md border">
                      <Table>
                          <TableHeader className="bg-muted/50 sticky top-0 z-10 shadow-sm">
                              <TableRow>
                                  <TableHead>Student</TableHead>
                                  <TableHead className="text-right">Status</TableHead>
                              </TableRow>
                          </TableHeader>
                          <TableBody>
                              {filteredStudents.map(s => (
                                  <TableRow key={s.uid}>
                                      <TableCell>
                                          <div className="flex flex-col">
                                              <span className="font-bold text-sm">{s.name}</span>
                                              <span className="text-[10px] font-mono text-muted-foreground uppercase">{s.id}</span>
                                          </div>
                                      </TableCell>
                                      <TableCell>
                                          <RadioGroup 
                                              value={attendance[s.uid] || 'Present'} 
                                              onValueChange={(v) => setAttendance(p => ({...p, [s.uid]: v as any}))}
                                              className="flex justify-end gap-2"
                                          >
                                              <div className="flex flex-col items-center">
                                                  <RadioGroupItem value="Present" id={`p-${s.uid}`} className="sr-only" />
                                                  <Label htmlFor={`p-${s.uid}`} className={cn("px-2 py-1 rounded-md text-[10px] font-bold border cursor-pointer", attendance[s.uid] === 'Present' ? "bg-primary text-primary-foreground border-primary" : "bg-background")}>PRESENT</Label>
                                              </div>
                                              <div className="flex flex-col items-center">
                                                  <RadioGroupItem value="Absent" id={`a-${s.uid}`} className="sr-only" />
                                                  <Label htmlFor={`a-${s.uid}`} className={cn("px-2 py-1 rounded-md text-[10px] font-bold border cursor-pointer", attendance[s.uid] === 'Absent' ? "bg-red-600 text-white border-red-600" : "bg-background")}>ABSENT</Label>
                                              </div>
                                              <div className="flex flex-col items-center">
                                                  <RadioGroupItem value="Late" id={`l-${s.uid}`} className="sr-only" />
                                                  <Label htmlFor={`l-${s.uid}`} className={cn("px-2 py-1 rounded-md text-[10px] font-bold border cursor-pointer", attendance[s.uid] === 'Late' ? "bg-orange-500 text-white border-orange-500" : "bg-background")}>LATE</Label>
                                              </div>
                                          </RadioGroup>
                                      </TableCell>
                                  </TableRow>
                              ))}
                          </TableBody>
                      </Table>
                  </div>
              </div>
              <DialogFooter className="border-t pt-4">
                  <DialogClose asChild><Button variant="outline">Discard</Button></DialogClose>
                  <Button onClick={handleSaveAttendance} disabled={savingAttendance || students.length === 0}>
                      {savingAttendance ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}
                      Save Attendance
                  </Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
    </div>
  );
}
