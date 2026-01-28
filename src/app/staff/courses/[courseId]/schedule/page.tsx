
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, PlusCircle, Trash2, Clock, Calendar as CalendarIcon, Save, ChevronLeft, ChevronRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { ref, get, set, push, onValue, remove, update } from 'firebase/database';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isToday } from 'date-fns';
import { useParams } from 'next/navigation';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type TimetableEntry = {
    id: string;
    day: string;
    startTime: string;
    endTime: string;
    venue: string;
};

type ClassOverride = {
    originalDate: string;
    newDate?: string;
    newTime?: string;
    status: 'rescheduled' | 'cancelled';
};

const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function CourseSchedulePage() {
    const params = useParams();
    const courseId = params.courseId as string;
    const [timetable, setTimetable] = React.useState<TimetableEntry[]>([]);
    const [overrides, setOverrides] = React.useState<Record<string, ClassOverride>>({});
    const [month, setMonth] = React.useState(new Date());
    const [loading, setLoading] = React.useState(true);
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [editingDate, setEditingDate] = React.useState<Date | null>(null);
    const [action, setAction] = React.useState<'reschedule' | 'cancel' | 'add'>('add');
    const [rescheduleDate, setRescheduleDate] = React.useState<Date | undefined>();
    const [rescheduleTime, setRescheduleTime] = React.useState('');
    const { toast } = useToast();

    React.useEffect(() => {
        if (!courseId) return;

        const fetchData = async () => {
            setLoading(true);
            const regsSnap = await get(ref(db, 'registrations'));
            let semesterId: string | null = null;
            if(regsSnap.exists()){
                const allRegs = regsSnap.val();
                for(const userId in allRegs){
                    for(const semId in allRegs[userId]){
                        if(allRegs[userId][semId].courses.includes(courseId)){
                            semesterId = semId;
                            break;
                        }
                    }
                    if(semesterId) break;
                }
            }

            if(semesterId){
                const timetableRef = ref(db, `timetables/${semesterId}/${courseId}`);
                onValue(timetableRef, (snapshot) => {
                    setTimetable(snapshot.exists() ? Object.values(snapshot.val()) : []);
                });
            } else {
                setTimetable([]);
            }
            
            const overridesRef = ref(db, `classOverrides/${courseId}`);
            onValue(overridesRef, snapshot => {
                setOverrides(snapshot.exists() ? snapshot.val() : {});
            });

            setLoading(false);
        };
        fetchData();
    }, [courseId]);

    const handleSaveOverride = async () => {
        if (!editingDate) return;
        const dateStr = format(editingDate, 'yyyy-MM-dd');
        const overrideRef = ref(db, `classOverrides/${courseId}/${dateStr}`);
        
        let overrideData: Partial<ClassOverride> = { originalDate: dateStr };
        if (action === 'cancel') {
            overrideData.status = 'cancelled';
        } else if (action === 'reschedule' && rescheduleDate && rescheduleTime) {
            overrideData.status = 'rescheduled';
            overrideData.newDate = format(rescheduleDate, 'yyyy-MM-dd');
            overrideData.newTime = rescheduleTime;
        } else {
             toast({ variant: 'destructive', title: 'Missing details for reschedule' });
             return;
        }

        try {
            await set(overrideRef, overrideData);
            toast({ title: 'Schedule Updated' });
            setIsDialogOpen(false);
        } catch (e) {
            toast({ variant: 'destructive', title: 'Update failed' });
        }
    };
    
    const handleOpenDialog = (date: Date, type: 'cancel' | 'reschedule') => {
        setEditingDate(date);
        setAction(type);
        setRescheduleDate(undefined);
        setRescheduleTime('');
        setIsDialogOpen(true);
    };

    const calendarClasses = React.useMemo(() => {
        const classesByDate: Record<string, { status: string, details?: string, time?: string }> = {};
        if (loading) return classesByDate;

        const interval = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });

        interval.forEach(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const dayOfWeek = daysOfWeek[getDay(day)];
            const regularClass = timetable.find(t => t.day === dayOfWeek);
            const override = overrides[dateStr];
            
            if (override) {
                 if (override.status === 'cancelled') {
                    classesByDate[dateStr] = { status: 'cancelled', details: `Cancelled class at ${regularClass?.startTime}` };
                } else if (override.status === 'rescheduled' && override.originalDate === dateStr) {
                    classesByDate[dateStr] = { status: 'cancelled', details: `Moved to ${format(parseISO(override.newDate!), 'MMM d')}` };
                }
            } else if (regularClass) {
                 const rescheduledFromThisDay = Object.values(overrides).find(ov => ov.status === 'rescheduled' && ov.originalDate === dateStr);
                 if (!rescheduledFromThisDay) {
                    classesByDate[dateStr] = { status: 'scheduled', time: regularClass.startTime };
                 }
            }
            
            const rescheduledToThisDay = Object.values(overrides).find(ov => ov.status === 'rescheduled' && ov.newDate === dateStr);
            if (rescheduledToThisDay) {
                classesByDate[dateStr] = { status: 'rescheduled', details: `Extra class (from ${format(parseISO(rescheduledToThisDay.originalDate), 'MMM d')})`, time: rescheduledToThisDay.newTime };
            }
        });
        return classesByDate;
    }, [month, timetable, overrides, loading]);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Class Schedule</CardTitle>
                <CardDescription>View the monthly schedule and make adjustments like cancelling or rescheduling classes.</CardDescription>
            </CardHeader>
            <CardContent>
                <Calendar
                    mode="single"
                    month={month}
                    onMonthChange={setMonth}
                    components={{
                        DayContent: ({ date }) => {
                            const dateStr = format(date, 'yyyy-MM-dd');
                            const classInfo = calendarClasses[dateStr];
                            return (
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <div className={cn("relative w-full h-full p-1 cursor-pointer hover:bg-accent/50 rounded-md",
                                            classInfo?.status === 'scheduled' && 'bg-primary/10',
                                            classInfo?.status === 'rescheduled' && 'bg-blue-500/10',
                                            classInfo?.status === 'cancelled' && 'bg-destructive/10 line-through'
                                        )}>
                                            <span className={cn("absolute top-1 left-1", isToday(date) && "font-bold")}>{format(date, 'd')}</span>
                                            {classInfo && (
                                                <div className="text-xs absolute bottom-1 right-1 font-bold">
                                                    {classInfo.time}
                                                </div>
                                            )}
                                        </div>
                                    </PopoverTrigger>
                                    {classInfo && (
                                        <PopoverContent className="w-56 p-2 space-y-2">
                                            <p className="font-bold text-sm">{format(date, 'PPP')}</p>
                                            <p className="text-xs">{classInfo.details || `Scheduled class at ${classInfo.time}`}</p>
                                            <Separator />
                                            <Button size="sm" variant="outline" className="w-full" onClick={() => handleOpenDialog(date, 'cancel')}>Cancel Class</Button>
                                            <Button size="sm" variant="outline" className="w-full" onClick={() => handleOpenDialog(date, 'reschedule')}>Reschedule Class</Button>
                                        </PopoverContent>
                                    )}
                                </Popover>
                            );
                        },
                        Caption: ({...props}) => {
                            const currentMonth = format(props.displayMonth, 'MMMM yyyy');
                            return (
                                <div className="flex items-center justify-between px-2 py-4">
                                    <h2 className="font-semibold text-lg">{currentMonth}</h2>
                                    <div className="flex gap-1">
                                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}><ChevronLeft className="h-4 w-4" /></Button>
                                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}><ChevronRight className="h-4 w-4" /></Button>
                                    </div>
                                </div>
                            )
                        }
                    }}
                    className="w-full"
                />
            </CardContent>
             <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Manage Class for {editingDate && format(editingDate, 'PPP')}</DialogTitle>
                    </DialogHeader>
                    {action === 'cancel' && <p>Are you sure you want to cancel this class?</p>}
                    {action === 'reschedule' && (
                        <div className="space-y-4">
                            <Popover>
                                <PopoverTrigger asChild><Button variant="outline" className="w-full"><CalendarIcon className="mr-2 h-4 w-4"/>{rescheduleDate ? format(rescheduleDate, 'PPP') : "Select new date"}</Button></PopoverTrigger>
                                <PopoverContent><Calendar mode="single" selected={rescheduleDate} onSelect={setRescheduleDate}/></PopoverContent>
                            </Popover>
                            <Input type="time" value={rescheduleTime} onChange={e => setRescheduleTime(e.target.value)} />
                        </div>
                    )}
                    <DialogFooter>
                        <DialogClose asChild><Button variant="outline">Back</Button></DialogClose>
                        <Button onClick={handleSaveOverride}>Confirm</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
