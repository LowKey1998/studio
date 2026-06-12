'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Users2, PartyPopper, Handshake, Search, Mail, Loader2, Award, Sparkles, PlusCircle, Calendar, Briefcase, Info, Linkedin } from 'lucide-react';
import { db, auth } from '@/lib/firebase';
import { ref, onValue, push, set, get, serverTimestamp } from 'firebase/database';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

type Alumni = { id: string; name: string; email: string; yearGraduated: number; company?: string; role?: string; bio?: string; linkedin?: string; };
type AlumniEvent = { id: string; title: string; date: string; description: string; };

export default function StudentAlumniPage() {
    const [currentUser, setCurrentUser] = React.useState<User | null>(null);
    const [userProfile, setUserProfile] = React.useState<any>(null);
    const [isCleared, setIsCleared] = React.useState(false);
    const [alreadyJoined, setAlreadyJoined] = React.useState(false);

    const [alumni, setAlumni] = React.useState<Alumni[]>([]);
    const [events, setEvents] = React.useState<AlumniEvent[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [registering, setRegistering] = React.useState(false);
    const [searchTerm, setSearchTerm] = React.useState('');
    const { toast } = useToast();

    // Join Network Form State
    const [gradYear, setGradYear] = React.useState(new Date().getFullYear());
    const [company, setCompany] = React.useState('');
    const [role, setRole] = React.useState('');
    const [bio, setBio] = React.useState('');
    const [linkedin, setLinkedin] = React.useState('');

    // Contact Dialog State
    const [selectedAlumni, setSelectedAlumni] = React.useState<Alumni | null>(null);
    const [contactSubject, setContactSubject] = React.useState('');
    const [contactBody, setContactBody] = React.useState('');
    const [sendingMsg, setSendingMsg] = React.useState(false);

    React.useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, user => {
            if (user) {
                setCurrentUser(user);
                // Fetch profile
                get(ref(db, `users/${user.uid}`)).then(snap => {
                    if (snap.exists()) setUserProfile(snap.val());
                });
                // Check clearance
                get(ref(db, `graduationClearances/${user.uid}`)).then(snap => {
                    if (snap.exists() && snap.val().overallStatus === 'Cleared') {
                        setIsCleared(true);
                    }
                });
            } else {
                setLoading(false);
            }
        });
        return () => unsubscribe();
    }, []);

    React.useEffect(() => {
        const alumniRef = ref(db, 'alumni/directory');
        const eventsRef = ref(db, 'alumni/events');

        const unsubAlumni = onValue(alumniRef, (snap) => {
            const list: Alumni[] = snap.exists() ? Object.keys(snap.val()).map(id => ({ id, ...snap.val()[id] })) : [];
            setAlumni(list);
            if (currentUser) {
                setAlreadyJoined(list.some(a => a.email === currentUser.email));
            }
        });

        const unsubEvents = onValue(eventsRef, (snap) => {
            setEvents(snap.exists() ? Object.keys(snap.val()).map(id => ({ id, ...snap.val()[id] })) : []);
            setLoading(false);
        });

        return () => { unsubAlumni(); unsubEvents(); };
    }, [currentUser]);

    const handleJoinNetwork = async () => {
        if (!currentUser || !userProfile) return;
        setRegistering(true);
        try {
            const newAlumniRef = push(ref(db, 'alumni/directory'));
            await set(newAlumniRef, {
                uid: currentUser.uid,
                name: userProfile.name || currentUser.displayName || 'Alumnus',
                email: currentUser.email,
                yearGraduated: Number(gradYear),
                company: company.trim() || null,
                role: role.trim() || null,
                bio: bio.trim() || null,
                linkedin: linkedin.trim() || null,
                registeredAt: serverTimestamp()
            });
            toast({ title: 'Welcome to the Alumni Network!', description: 'Your profile has been successfully published to the directory.' });
            setAlreadyJoined(true);
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Registration Failed', description: e.message });
        } finally {
            setRegistering(false);
        }
    };

    const handleSendContactMessage = async () => {
        if (!selectedAlumni || !contactSubject || !contactBody || !currentUser) return;
        setSendingMsg(true);
        try {
            // Push message request to the database
            const msgRef = push(ref(db, 'alumni/messages'));
            await set(msgRef, {
                senderId: currentUser.uid,
                senderName: userProfile?.name || currentUser.displayName || 'Student',
                senderEmail: currentUser.email,
                recipientId: selectedAlumni.id,
                recipientName: selectedAlumni.name,
                recipientEmail: selectedAlumni.email,
                subject: contactSubject,
                body: contactBody,
                timestamp: serverTimestamp()
            });
            toast({ title: 'Message Sent!', description: `Your networking inquiry was successfully sent to ${selectedAlumni.name}.` });
            setSelectedAlumni(null);
            setContactSubject(''); setContactBody('');
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Failed to send message', description: e.message });
        } finally {
            setSendingMsg(false);
        }
    };

    const filteredAlumni = alumni.filter(a => 
        a.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        a.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (a.company && a.company.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (a.role && a.role.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    if (loading) return <div className="p-6 space-y-4"><Loader2 className="animate-spin text-primary" /> Loading Alumni Connect portal...</div>;

    return (
        <div className="space-y-6">
            <Card className="shadow-lg border-0 bg-primary/5">
                <CardHeader>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-1">
                            <CardTitle className="font-headline text-3xl flex items-center gap-2">
                                <Handshake className="text-primary h-8 w-8" /> Alumni Connect Hub
                            </CardTitle>
                            <CardDescription>Network with graduates, browse official events, and build your professional community.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            {/* Congratulatory / Invitation block */}
            {isCleared && !alreadyJoined && (
                <div className="p-5 rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm animate-in fade-in duration-500">
                    <div className="flex items-start gap-3">
                        <Award className="h-10 w-10 text-primary mt-1 shrink-0 animate-bounce" />
                        <div className="space-y-1">
                            <h4 className="font-black text-primary text-base flex items-center gap-1.5">You are Graduation Cleared! <Sparkles className="h-4 w-4" /></h4>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                As a newly cleared graduate, you are invited to join the official university Alumni Directory. Publish your profile to help current students find networking opportunities!
                            </p>
                        </div>
                    </div>
                    <Button onClick={() => {
                        const tabTrigger = document.querySelector('[value="join"]') as HTMLButtonElement;
                        if (tabTrigger) tabTrigger.click();
                    }} className="font-bold shrink-0">Join Directory Now</Button>
                </div>
            )}

            <Tabs defaultValue="directory">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="directory"><Users2 className="mr-2 h-4 w-4"/> Alumni Directory</TabsTrigger>
                    <TabsTrigger value="events"><PartyPopper className="mr-2 h-4 w-4"/> Alumni Events</TabsTrigger>
                    <TabsTrigger value="join"><PlusCircle className="mr-2 h-4 w-4"/> Join Network</TabsTrigger>
                </TabsList>

                <TabsContent value="directory" className="pt-4 space-y-4">
                    <Card>
                        <CardHeader>
                            <div className="relative">
                                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <Input placeholder="Search alumni by name, email, company, or role..." className="pl-10 h-11" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {filteredAlumni.map(a => (
                                    <Card key={a.id} className="p-5 hover:shadow-md transition-all duration-300 flex flex-col justify-between border-muted/50 bg-background/50">
                                        <div className="space-y-3">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <p className="font-bold text-base text-foreground leading-snug">{a.name}</p>
                                                    <p className="text-xs text-muted-foreground font-semibold">Class of {a.yearGraduated}</p>
                                                </div>
                                                {a.linkedin && (
                                                    <a href={a.linkedin} target="_blank" rel="noopener noreferrer" className="text-[#0A66C2] hover:opacity-80 transition-opacity">
                                                        <Linkedin className="h-5 w-5" />
                                                    </a>
                                                )}
                                            </div>
                                            {(a.role || a.company) && (
                                                <div className="text-xs space-y-1 bg-muted/30 p-2.5 rounded-lg border">
                                                    {a.role && <p className="font-semibold text-foreground flex items-center gap-1.5"><Briefcase className="h-3.5 w-3.5 opacity-60" /> {a.role}</p>}
                                                    {a.company && <p className="text-muted-foreground italic pl-5">{a.company}</p>}
                                                </div>
                                            )}
                                            {a.bio && (
                                                <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                                                    {a.bio}
                                                </p>
                                            )}
                                        </div>
                                        <Button variant="outline" size="sm" className="mt-5 self-start h-8" onClick={() => setSelectedAlumni(a)}><Mail className="mr-1.5 h-3.5 w-3.5"/> Contact Alumnus</Button>
                                    </Card>
                                ))}
                                {filteredAlumni.length === 0 && (
                                    <div className="col-span-full py-12 text-center text-muted-foreground italic">
                                        No alumni records match your query.
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="events" className="pt-4 space-y-4">
                    <div className="grid gap-4">
                        {events.length > 0 ? events.map(event => (
                            <Card key={event.id} className="border-l-4 border-l-primary hover:shadow-sm transition-all duration-300">
                                <CardHeader className="py-4">
                                    <div className="flex justify-between items-start gap-4">
                                        <div className="space-y-1">
                                            <CardTitle className="text-lg font-black">{event.title}</CardTitle>
                                            <CardDescription className="flex items-center gap-1 text-xs font-semibold">
                                                <Calendar className="h-3.5 w-3.5 text-primary" />
                                                {format(new Date(event.date), 'PPPP')}
                                            </CardDescription>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="pb-4">
                                    <p className="text-sm text-foreground/80 leading-relaxed">{event.description}</p>
                                </CardContent>
                            </Card>
                        )) : (
                            <div className="py-20 text-center border border-dashed rounded-2xl bg-muted/5">
                                <PartyPopper className="mx-auto h-12 w-12 opacity-10 mb-3" />
                                <p className="text-sm text-muted-foreground">No upcoming alumni networking events scheduled currently.</p>
                            </div>
                        )}
                    </div>
                </TabsContent>

                <TabsContent value="join" className="pt-4 space-y-4">
                    <Card className="max-w-2xl mx-auto">
                        <CardHeader>
                            <CardTitle>Register as Alumnus</CardTitle>
                            <CardDescription>
                                Add your current career profile details to join the professional database.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {alreadyJoined ? (
                                <div className="p-4 rounded-xl border border-green-200 bg-green-50 flex items-start gap-3">
                                    <Award className="h-6 w-6 text-green-600 mt-0.5 shrink-0" />
                                    <div>
                                        <h4 className="font-bold text-green-800 text-sm">Your Alumnus Profile is Active!</h4>
                                        <p className="text-xs text-green-700 mt-0.5">
                                            You have successfully registered in the Alumni Directory. Your classmate directory profile will remain searchable to help students coordinate mentorship opportunities.
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <Label>Graduation Year</Label>
                                            <Input type="number" value={gradYear} onChange={e => setGradYear(Number(e.target.value))} />
                                        </div>
                                        <div className="space-y-1">
                                            <Label>LinkedIn Profile URL</Label>
                                            <Input placeholder="https://linkedin.com/in/username" value={linkedin} onChange={e => setLinkedin(e.target.value)} />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <Label>Current Company</Label>
                                            <Input placeholder="e.g., General Hospital, Google, etc." value={company} onChange={e => setCompany(e.target.value)} />
                                        </div>
                                        <div className="space-y-1">
                                            <Label>Job Title / Role</Label>
                                            <Input placeholder="e.g., Nursing Officer, Software Engineer" value={role} onChange={e => setRole(e.target.value)} />
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <Label>Professional Bio / Short Intro</Label>
                                        <Textarea placeholder="Share details about your clinical specialty, current goals, or mentorship readiness..." className="min-h-[100px]" value={bio} onChange={e => setBio(e.target.value)} />
                                    </div>
                                    <Button onClick={handleJoinNetwork} className="w-full" disabled={registering}>
                                        {registering && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
                                        Submit Profile & Register
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Contact Dialog */}
            <Dialog open={!!selectedAlumni} onOpenChange={open => !open && setSelectedAlumni(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Contact Alumnus: {selectedAlumni?.name}</DialogTitle>
                        <DialogDescription>
                            Send a networking inquiry or mentorship query directly to this graduate.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-1">
                            <Label>Subject</Label>
                            <Input placeholder="e.g., Mentorship inquiry / Career guidance" value={contactSubject} onChange={e => setContactSubject(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                            <Label>Message Content</Label>
                            <Textarea placeholder="Write your message here... Introduce yourself, specify your course details, and outline what guidance you are looking for." className="min-h-[150px]" value={contactBody} onChange={e => setContactBody(e.target.value)} />
                        </div>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                        <Button onClick={handleSendContactMessage} disabled={sendingMsg || !contactSubject || !contactBody}>
                            {sendingMsg && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
                            Send Message
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
