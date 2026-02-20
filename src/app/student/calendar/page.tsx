'use client';
import * as React from 'react';
import { format, parseISO, isSameDay } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Download, Info, Search, CalendarDays, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { db, auth } from '@/lib/firebase';
import { ref, get } from 'firebase/database';
import { Skeleton } from '@/components/ui/skeleton';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { getZambianPublicHolidays } from '@/lib/holidays';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { calculateAcademicState, parseIntakeDate } from '@/lib/semester-utils';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

type CalendarEvent = {
  id: string;
  title: string;
  date: string;
  semester?: string;
  isPublicHoliday?: boolean;
  attachmentUrl?: string;
  attachmentName?: string;
};

export default function StudentCalendarPage() {
  const [allUserEvents, setAllUserEvents] = React.useState<CalendarEvent[]>([]);
  const [enrolledSemesters, setEnrolledSemesters] = React.useState<string[]>([]);
  const [currentSemesterName, setCurrentSemesterName] = React.useState<string | null>(null);
  const [academicStanding, setAcademicStanding] = React.useState<string>('');
  const [loading, setLoading] = React.useState(true);
  const [selectedDay, setSelectedDay] = React.useState<Date | undefined>();
  const [popoverOpen, setPopoverOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [currentUser, setCurrentUser] = React.useState<User | null>(null);
  const [semesterFilter, setSemesterFilter] = React.useState('current');

  const { toast } = useToast();
  
  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
        setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  React.useEffect(() => {
    if (!currentUser) return;

    const fetchEventsAndRegistrations = async () => {
      setLoading(true);
      try {
        const [
            userSnap,
            registrationsSnapshot, 
            eventsSnapshot, 
            holidays,
            semestersSnap,
            intakesSnap,
            calendarSnap
        ] = await Promise.all([
            get(ref(db, `users/${currentUser.uid}`)),
            get(ref(db, `registrations/${currentUser.uid}`)), 
            get(ref(db, 'calendarEvents')), 
            getZambianPublicHolidays(new Date().getFullYear()),
            get(ref(db, 'semesters')),
            get(ref(db, 'intakes')),
            get(ref(db, 'settings/academicCalendar'))
        ]);
        
        if (!userSnap.exists()) throw new Error("Profile not found");
        const profile = userSnap.val();
        const allIntakes = intakesSnap.val() || {};
        const intakeName = profile.intakeId ? allIntakes[profile.intakeId]?.name : null;

        // 1. Calculate Standing & Current Semester
        let currentSemName: string | null = null;
        if (intakeName && calendarSnap.exists()) {
            const intakeStartStr = parseIntakeDate(intakeName);
            if (intakeStartStr) {
                const state = calculateAcademicState(
                    intakeStartStr,
                    new Date(),
                    calendarSnap.val().standardCycles,
                    Object.values(calendarSnap.val().anomalies || {})
                );
                setAcademicStanding(`Year ${state.year}, Sem ${state.semester}`);

                const matched = Object.values(semestersSnap.val() || {}).find((s: any) => 
                    s.intakeId === profile.intakeId && 
                    s.year === state.year && 
                    s.semesterInYear === state.semester
                ) as any;
                
                if (matched) {
                    currentSemName = matched.name;
                    setCurrentSemesterName(matched.name);
                }
            }
        }

        // 2. Get student's historical enrolled semesters
        const semesters: string[] = [];
        if(registrationsSnapshot.exists()) {
            const regs = registrationsSnapshot.val();
            for(const semesterId in regs) {
                if(regs[semesterId].status === 'Completed' || regs[semesterId].status === 'Pending Payment') {
                    const semInfo = semestersSnap.val()?.[semesterId];
                    if (semInfo) semesters.push(semInfo.name);
                }
            }
        }
        setEnrolledSemesters([...new Set(semesters)]);

        // 3. Process all calendar events
        const eventsList: CalendarEvent[] = [];
        if (eventsSnapshot.exists()) {
            Object.entries(eventsSnapshot.val()).forEach(([id, event]) => {
                eventsList.push({ id, ...(event as any) });
            });
        }
        holidays.forEach(holiday => {
            eventsList.push({ id: holiday.name, title: holiday.name, date: holiday.date, isPublicHoliday: true });
        });
        
        setAllUserEvents(eventsList);

      } catch (error) {
        console.error('Error fetching calendar data:', error);
        toast({
          variant: 'destructive',
          title: 'Failed to load events',
          description: 'Could not fetch calendar data.',
        });
      } finally {
        setLoading(false);
      }
    };
    fetchEventsAndRegistrations();
  }, [currentUser, toast]);

  const handleDownloadPdf = () => {
    const doc = new jsPDF();
    doc.setFontSize(18); doc.text('Academic Calendar', 14, 22);
    
    const tableColumn = ["Date", "Event"];
    const tableRows = filteredEvents
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map(event => [
        format(parseISO(event.date), 'MMM dd, yyyy'),
        event.title
      ]);

    (doc as any).autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 30,
    });

    doc.save('academic-calendar.pdf');
  };
  
  const handleDateSelect = (day: Date | undefined) => {
    if (!day) return;
    const eventsOnDay = allUserEvents.filter(event => isSameDay(parseISO(event.date), day));
    if (eventsOnDay.length > 0) {
      setSelectedDay(day);
      setPopoverOpen(true);
    } else {
        setSelectedDay(day);
        setPopoverOpen(false);
    }
  };

  const filteredEvents = React.useMemo(() => {
    return allUserEvents
        .filter(event => {
            // Priority 1: Public Holidays
            if (event.isPublicHoliday) return true;
            
            // Priority 2: General events
            const isGeneral = !event.semester || event.semester === 'General';
            
            if (semesterFilter === 'current') {
                return isGeneral || (currentSemesterName && event.semester === currentSemesterName);
            }
            if (semesterFilter === 'all') {
                return isGeneral || (event.semester && enrolledSemesters.includes(event.semester));
            }
            if (semesterFilter === 'general') {
                return isGeneral;
            }
            return event.semester === semesterFilter;
        })
        .filter(event => event.title.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [allUserEvents, searchTerm, semesterFilter, currentSemesterName, enrolledSemesters]);
  
  const eventDates = React.useMemo(() => {
    return allUserEvents
        .filter(e => !e.isPublicHoliday)
        .map(event => parseISO(event.date));
  }, [allUserEvents]);

  const holidayDates = React.useMemo(() => {
    return allUserEvents
        .filter(e => e.isPublicHoliday)
        .map(event => parseISO(event.date));
  }, [allUserEvents]);

  const eventsOnSelectedDay = selectedDay ? filteredEvents.filter(event => isSameDay(parseISO(event.date), selectedDay)) : [];

  return (
    <div className="space-y-6">
      <Card className="shadow-lg border-0 bg-primary/5">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="font-headline text-2xl">Academic Calendar</CardTitle>
              <CardDescription>View important school dates and deadlines relevant to your standing.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
                {academicStanding && (
                    <Badge variant="secondary" className="h-10 px-4 gap-2 font-black uppercase tracking-widest text-[10px] border-primary/20 bg-background shadow-sm">
                        <CalendarDays className="h-4 w-4 text-primary" />
                        Standing: {academicStanding}
                    </Badge>
                )}
                <Button variant="outline" onClick={handleDownloadPdf} disabled={loading || allUserEvents.length === 0} className="h-10">
                    <Download className="mr-2 h-4 w-4" />
                    Download PDF
                </Button>
            </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-6 md:flex-row pt-6">
          <div className="flex justify-center rounded-xl border bg-background p-4 shadow-sm h-fit">
             {loading ? (
                <Skeleton className="h-[250px] w-[280px]" />
            ) : (
              <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                  <PopoverTrigger asChild>
                    <div className="cursor-pointer">
                      <Calendar
                        mode="single"
                        selected={selectedDay}
                        onSelect={handleDateSelect}
                        modifiers={{ highlighted: eventDates, holiday: holidayDates }}
                        modifiersClassNames={{
                          highlighted: 'bg-primary/20 text-primary rounded-full font-bold',
                          holiday: 'bg-destructive/20 text-destructive rounded-full font-bold',
                        }}
                        className="p-0"
                      />
                    </div>
                  </PopoverTrigger>
                  {selectedDay && (
                    <PopoverContent className="w-80">
                      <div className="grid gap-4">
                        <div className="space-y-2">
                          <h4 className="font-bold leading-none text-primary border-b pb-2">{format(selectedDay, 'PPP')}</h4>
                          <div className="space-y-2 pt-1">
                            {eventsOnSelectedDay.length > 0 ? eventsOnSelectedDay.map(event => (
                              <div key={event.id} className="text-sm">
                                  <p className={cn("font-semibold", event.isPublicHoliday ? "text-destructive" : "text-foreground")}>{event.title}</p>
                                  {event.semester && <p className="text-[10px] text-muted-foreground uppercase">{event.semester}</p>}
                              </div>
                            )) : (
                                <p className="text-sm text-muted-foreground italic">No events scheduled for this day.</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </PopoverContent>
                  )}
                </Popover>
            )}
          </div>
          <div className="flex-1 space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="font-headline text-lg font-bold">Upcoming Dates</h3>
                <div className="flex items-center gap-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground">Scope:</Label>
                    <Select value={semesterFilter} onValueChange={setSemesterFilter}>
                        <SelectTrigger className="w-[180px] h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="current" className="font-bold">Current Standing</SelectItem>
                            <SelectItem value="all">All My Semesters</SelectItem>
                            <SelectItem value="general">Institutional Only</SelectItem>
                            <Separator className="my-1"/>
                            {enrolledSemesters.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            </div>
            
            <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Filter list by title..." className="pl-8 h-9 shadow-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>

            <ScrollArea className="h-[400px] rounded-md border bg-muted/5 p-4">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4 rounded-md border p-3 mb-3 bg-background">
                        <Skeleton className="h-5 w-24" /><Skeleton className="h-4 w-full" />
                    </div>
                ))
              ) : filteredEvents.length > 0 ? (
                [...filteredEvents]
                  .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                  .map(event => (
                    <div key={event.id} className={cn(
                        "flex items-center gap-4 rounded-md border p-3 mb-3 transition-colors hover:bg-muted/50",
                        event.isPublicHoliday ? "bg-red-50/30 border-red-100" : "bg-background"
                    )}>
                      <div className={cn("w-24 shrink-0 font-bold text-xs flex flex-col", event.isPublicHoliday && "text-destructive")}>
                          <span>{format(parseISO(event.date), 'MMM dd')}</span>
                          <span className="text-[10px] opacity-60 font-normal">{format(parseISO(event.date), 'yyyy')}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                          <p className={cn("text-sm font-semibold truncate", event.isPublicHoliday ? "text-destructive" : "text-foreground")}>{event.title}</p>
                          {event.semester && <p className="text-[10px] text-muted-foreground uppercase font-medium">{event.semester}</p>}
                      </div>
                      {event.attachmentUrl && (
                        <Button asChild size="icon" variant="ghost" className="h-8 w-8 text-primary">
                            <a href={event.attachmentUrl} target="_blank" rel="noopener noreferrer" title={`Download ${event.attachmentName}`}>
                                <Download className="h-4 w-4"/>
                            </a>
                        </Button>
                      )}
                    </div>
                  ))
              ) : (
                <div className="text-center py-20 text-muted-foreground">
                    <Info className="mx-auto h-12 w-12 opacity-10 mb-4" />
                    <p className="text-sm">No events match your current standing or filters.</p>
                </div>
              )}
            </ScrollArea>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
