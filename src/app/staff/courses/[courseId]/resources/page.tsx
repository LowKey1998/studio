
'use client';
import * as React from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Loader2, Upload, Link as LinkIcon, Trash2 } from "lucide-react";
import { db, auth, storage } from '@/lib/firebase';
import { ref, get, set, push, remove, onValue } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Resource = { id: string; title: string; description: string; type: 'file' | 'link'; url: string; fileName?: string; };
type UserData = { role: 'Student' | 'Staff'; subRoles?: string[]; };

export default function CourseResourcesPage() {
    const params = useParams();
    const courseId = params.courseId as string;
    const [resources, setResources] = React.useState<Resource[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [currentUser, setCurrentUser] = React.useState<User | null>(null);
    const [userData, setUserData] = React.useState<UserData | null>(null);

    const [isResourceDialogOpen, setIsResourceDialogOpen] = React.useState(false);
    const [formLoading, setFormLoading] = React.useState(false);
    
    const [title, setTitle] = React.useState('');
    const [description, setDescription] = React.useState('');
    const [resourceType, setResourceType] = React.useState<'file' | 'link'>('file');
    const [resourceLink, setResourceLink] = React.useState('');
    const [resourceFile, setResourceFile] = React.useState<File | null>(null);
    
    const { toast } = useToast();

    React.useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
          if (user) {
            setCurrentUser(user);
            const userRef = ref(db, `users/${user.uid}`);
            onValue(userRef, (snapshot) => {
                if (snapshot.exists()) setUserData(snapshot.val());
            });
          }
        });
        return () => unsubscribe();
    }, []);
    
    const fetchData = React.useCallback(async () => {
        setLoading(true);
        try {
            const resourcesRef = ref(db, `resources/${courseId}`);
            const resourcesSnapshot = await get(resourcesRef);
            setResources(resourcesSnapshot.exists() ? Object.entries(resourcesSnapshot.val()).map(([id, data]) => ({ id, ...(data as any) })) : []);
        } catch (error) { console.error("Error fetching resources:", error); } 
        finally { setLoading(false); }
    }, [courseId]);

    React.useEffect(() => {
        if(currentUser) fetchData();
    }, [currentUser, fetchData]);
    
    const resetForms = () => {
        setTitle(''); setDescription(''); setResourceLink(''); setResourceFile(null);
    };
    
    const handleAddResource = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title || (resourceType === 'link' && !resourceLink) || (resourceType === 'file' && !resourceFile)) { toast({ variant: 'destructive', title: 'Missing Fields' }); return; }
        setFormLoading(true);
        try {
            let url = resourceLink;
            let fileName;
            if (resourceType === 'file' && resourceFile) {
                const fileRef = storageRef(storage, `resources/${courseId}/${Date.now()}_${resourceFile.name}`);
                const snapshot = await uploadBytes(fileRef, resourceFile);
                url = await getDownloadURL(snapshot.ref);
                fileName = resourceFile.name;
            }
            const newRef = push(ref(db, `resources/${courseId}`));
            await set(newRef, { title, description, type: resourceType, url, fileName });
            toast({ title: 'Resource Added' });
            fetchData(); resetForms(); setIsResourceDialogOpen(false);
        } catch (error: any) { toast({ variant: 'destructive', title: 'Failed to add', description: error.message }); }
        finally { setFormLoading(false); }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("Are you sure you want to delete this item?")) return;
        try {
            await remove(ref(db, `resources/${courseId}/${id}`));
            toast({ title: "Item deleted successfully." });
            fetchData();
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Deletion Failed', description: error.message });
        }
    };
    
    const isLecturer = userData?.role === 'Staff' && userData?.subRoles?.includes('Lecturer');

    return (
        <Card>
            <CardHeader className="flex-row items-center justify-between">
                <div className="space-y-1">
                    <CardTitle>Resources</CardTitle>
                    <CardDescription>Upload files or add links for students.</CardDescription>
                </div>
                 {isLecturer && (
                    <Dialog open={isResourceDialogOpen} onOpenChange={(o) => { setIsResourceDialogOpen(o); if(!o) resetForms(); }}>
                        <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4 w-4" /> Add Resource</Button></DialogTrigger>
                        <DialogContent><form onSubmit={handleAddResource}>
                            <DialogHeader><DialogTitle>New Resource</DialogTitle></DialogHeader>
                            <div className="grid gap-4 py-4">
                                <Input placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} required/>
                                <Textarea placeholder="Description (optional)" value={description} onChange={e => setDescription(e.target.value)} />
                                <Tabs defaultValue="file" onValueChange={(v) => setResourceType(v as any)}><TabsList className="grid w-full grid-cols-2"><TabsTrigger value="file"><Upload className="mr-2 h-4 w-4" />File</TabsTrigger><TabsTrigger value="link"><LinkIcon className="mr-2 h-4 w-4" />Link</TabsTrigger></TabsList>
                                    <TabsContent value="file" className="pt-4"><Input type="file" onChange={(e) => setResourceFile(e.target.files?.[0] || null)} required={resourceType==='file'}/></TabsContent>
                                    <TabsContent value="link" className="pt-4"><Input type="url" placeholder="https://..." value={resourceLink} onChange={e => setResourceLink(e.target.value)} required={resourceType==='link'} /></TabsContent>
                                </Tabs>
                            </div>
                            <DialogFooter><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button type="submit" disabled={formLoading}>{formLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Add'}</Button></DialogFooter>
                        </form></DialogContent>
                    </Dialog>
                )}
            </CardHeader>
            <CardContent>
                {resources.length > 0 ? resources.map(r => (
                   <Card key={r.id} className="mb-4">
                       <CardHeader>
                           <CardTitle className="flex items-center gap-2">{r.type === 'file' ? <Upload/> : <LinkIcon/>} {r.title}</CardTitle>
                           <CardDescription>{r.description}</CardDescription>
                       </CardHeader>
                       <CardContent><a href={r.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">{r.fileName || r.url}</a></CardContent>
                       <CardFooter className="justify-end">
                           <Button variant="destructive" size="icon" onClick={() => handleDelete(r.id)}><Trash2 className="h-4 w-4"/></Button>
                       </CardFooter>
                   </Card>
                )) : <p className="text-muted-foreground text-center py-8">No resources added yet.</p>}
            </CardContent>
        </Card>
    );
}
