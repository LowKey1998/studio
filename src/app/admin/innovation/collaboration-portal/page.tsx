
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Search, PlusCircle, MessageSquare } from "lucide-react";
import { Input } from '@/components/ui/input';
import { db, auth } from '@/lib/firebase';
import { ref, onValue, set, push, remove, serverTimestamp } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/hooks/use-auth';
import { Loader2 } from 'lucide-react';


type Profile = {
    id: string;
    userId: string;
    userName: string;
    userAvatar?: string;
    skills: string;
    interests: string;
    lookingFor: string;
    timestamp: number;
};

export default function CollaborationPortalPage() {
    const [profiles, setProfiles] = React.useState<Profile[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [formLoading, setFormLoading] = React.useState(false);
    const [searchTerm, setSearchTerm] = React.useState('');

    // Form state
    const [skills, setSkills] = React.useState('');
    const [interests, setInterests] = React.useState('');
    const [lookingFor, setLookingFor] = React.useState('');

    const { user, userProfile } = useAuth();
    const { toast } = useToast();

    React.useEffect(() => {
        const profilesRef = ref(db, 'collaborationProfiles');
        const unsub = onValue(profilesRef, (snapshot) => {
            setProfiles(snapshot.exists() ? Object.entries(snapshot.val()).map(([id, data]) => ({ id, ...(data as any) })).sort((a,b) => b.timestamp - a.timestamp) : []);
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const resetForm = () => {
        setSkills(''); setInterests(''); setLookingFor('');
    };

    const handlePostProfile = async () => {
        if (!user || !userProfile || !skills || !interests || !lookingFor) {
            toast({ variant: 'destructive', title: 'All fields are required.' });
            return;
        }
        setFormLoading(true);
        try {
            await set(ref(db, `collaborationProfiles/${user.uid}`), {
                userId: user.uid,
                userName: userProfile.name,
                userAvatar: userProfile.profilePictureUrl || '',
                skills,
                interests,
                lookingFor,
                timestamp: serverTimestamp()
            });
            toast({ title: 'Profile Updated!' });
            setIsDialogOpen(false);
            resetForm();
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Failed to post profile', description: e.message });
        } finally {
            setFormLoading(false);
        }
    };
    
    const filteredProfiles = profiles.filter(p => 
        p.skills.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.interests.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.lookingFor.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.userName.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    const myProfile = user ? profiles.find(p => p.userId === user.uid) : null;

    return (
        <div className="space-y-6">
             <Card>
                <CardHeader className="flex-row items-center justify-between">
                    <div>
                        <CardTitle>Collaboration & Team Building Portal</CardTitle>
                        <CardDescription>Find collaborators for your projects based on skills and interests.</CardDescription>
                    </div>
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild>
                            <Button onClick={() => {
                                if (myProfile) {
                                    setSkills(myProfile.skills);
                                    setInterests(myProfile.interests);
                                    setLookingFor(myProfile.lookingFor);
                                } else {
                                    resetForm();
                                }
                            }}>
                                <PlusCircle className="mr-2 h-4 w-4"/> {myProfile ? 'Update My Profile' : 'Create My Profile'}
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>{myProfile ? 'Update' : 'Create'} Collaboration Profile</DialogTitle>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="space-y-1"><Label>My Skills</Label><Input value={skills} onChange={e => setSkills(e.target.value)} placeholder="e.g., Python, UI/UX, Marketing"/></div>
                                <div className="space-y-1"><Label>My Interests</Label><Input value={interests} onChange={e => setInterests(e.target.value)} placeholder="e.g., EdTech, Fintech, Agritech"/></div>
                                <div className="space-y-1"><Label>I'm Looking For</Label><Textarea value={lookingFor} onChange={e => setLookingFor(e.target.value)} placeholder="e.g., A backend developer to build an API..."/></div>
                            </div>
                            <DialogFooter>
                                <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                                <Button onClick={handlePostProfile} disabled={formLoading}>{formLoading ? <Loader2 className="mr-2"/> : 'Save Profile'}</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-2">
                        <Input placeholder="Search for skills, interests, or people..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/>
                        <Button><Search className="mr-2 h-4 w-4"/>Search</Button>
                    </div>
                </CardContent>
            </Card>
             <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? Array.from({length: 3}).map((_, i) => <Skeleton key={i} className="h-64"/>) 
                : filteredProfiles.map(profile => (
                    <Card key={profile.id} className="flex flex-col">
                        <CardHeader className="flex-row items-center gap-4">
                             <Avatar>
                                <AvatarImage src={profile.userAvatar} />
                                <AvatarFallback>{profile.userName.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div>
                                <CardTitle>{profile.userName}</CardTitle>
                                <CardDescription>{formatDistanceToNow(new Date(profile.timestamp), { addSuffix: true })}</CardDescription>
                            </div>
                        </CardHeader>
                         <CardContent className="flex-grow space-y-4">
                            <div>
                                <p className="text-sm font-semibold">Skills:</p>
                                <div className="flex flex-wrap gap-1 mt-1">{profile.skills.split(',').map(s => <Badge key={s} variant="secondary">{s.trim()}</Badge>)}</div>
                            </div>
                             <div>
                                <p className="text-sm font-semibold">Interests:</p>
                                <p className="text-sm text-muted-foreground">{profile.interests}</p>
                            </div>
                             <div>
                                <p className="text-sm font-semibold">Looking for:</p>
                                <p className="text-sm text-muted-foreground">{profile.lookingFor}</p>
                            </div>
                        </CardContent>
                        <CardFooter>
                            <Button className="w-full" disabled><MessageSquare className="mr-2 h-4"/> Message</Button>
                        </CardFooter>
                    </Card>
                ))}
            </div>
        </div>
    );
}

