
'use client';
import * as React from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Loader2, Upload, Link as LinkIcon, Trash2, Download, FileText, Globe } from "lucide-react";
import { db, storage } from '@/lib/firebase';
import { ref, get, set, push, remove, onValue } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from '@/hooks/use-auth';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';

type Resource = { id: string; title: string; description: string; type: 'file' | 'link'; url: string; fileName?: string; };

export default function CourseResourcesPage() {
    const params = useParams();
    const courseId = params.courseId as string;
    const [resources, setResources] = React.useState<Resource[]>([]);
    const [courseData, setCourseData] = React.useState<any>(null);
    const [loading, setLoading] = React.useState(true);
    const { user, userProfile } = useAuth();

    const [isResourceDialogOpen, setIsResourceDialogOpen] = React.useState(false);
    const [formLoading, setFormLoading] = React.useState(false);
    
    const [title, setTitle] = React.useState('');
    const [description, setDescription] = React.useState('');
    const [resourceType, setResourceType] = React.useState<'file' | 'link'>('file');
    const [resourceLink, setResourceLink] = React.useState('');
    const [resourceFile, setResourceFile] = React.useState<File | null>(null);
    
    const { toast } = useToast();

    const fetchData = React.useCallback(async () => {
        if (!courseId) return;
        setLoading(true);
        try {
            const [resourcesSnap, courseSnap] = await Promise.all([
                get(ref(db, `resources/${courseId}`)),
                get(ref(db, `courses/${courseId}`))
            ]);
            
            if (courseSnap.exists()) {
                setCourseData(courseSnap.val());
            }
            
            setResources(resourcesSnap.exists() ? Object.entries(resourcesSnap.val()).map(([id, data]) => ({ id, ...(data as any) })) : []);
        } catch (error) { 
            console.error("Error fetching resources:", error); 
        } finally { 
            setLoading(false); 
        }
    }, [courseId]);

    React.useEffect(() => {
        if(user) fetchData();
    }, [user, fetchData]);
    
    const resetForms = () => {
        setTitle(''); 
        setDescription(''); 
        setResourceLink(''); 
        setResourceFile(null);
    };
    
    const handleAddResource = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title || (resourceType === 'link' && !resourceLink) || (resourceType === 'file' && !resourceFile)) { 
            toast({ variant: 'destructive', title: 'Missing Fields' }); 
            return; 
        }
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
            fetchData(); 
            resetForms(); 
            setIsResourceDialogOpen(false);
        } catch (error: any) { 
            toast({ variant: 'destructive', title: 'Failed to add', description: error.message }); 
        } finally { 
            setFormLoading(false); 
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("Are you sure you want to delete this resource?")) return;
        try {
            await remove(ref(db, `resources/${courseId}/${id}`));
            toast({ title: "Resource removed successfully." });
            fetchData();
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Deletion Failed', description: error.message });
        }
    };
    
    const isAuthorized = React.useMemo(() => {
        if (!user || !courseData) return false;
        if (userProfile?.role === 'Admin') return true;
        const assignedLecturers = courseData.lecturerIds || [];
        return Array.isArray(assignedLecturers) && assignedLecturers.includes(user.uid);
    }, [user, userProfile, courseData]);

    if (loading) return <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"><Skeleton className="h-48 w-full" /><Skeleton className="h-48 w-full" /><Skeleton className="h-48 w-full" /></div>;

    return (
        <Card>
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                    <CardTitle>Course Resources</CardTitle>
                    <CardDescription>Upload learning materials or add links for students.</CardDescription>
                </div>
                 {isAuthorized && (
                    <Dialog open={isResourceDialogOpen} onOpenChange={(o) => { setIsResourceDialogOpen(o); if(!o) resetForms(); }}>
                        <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4 w-4" /> Add Resource</Button></DialogTrigger>
                        <DialogContent><form onSubmit={handleAddResource}>
                            <DialogHeader><DialogTitle>New Resource</DialogTitle></DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="space-y-1">
                                    <Label>Title</Label>
                                    <Input placeholder="e.g., Lecture Notes - Week 1" value={title} onChange={e => setTitle(e.target.value)} required/>
                                </div>
                                <div className="space-y-1">
                                    <Label>Description</Label>
                                    <Textarea placeholder="Optional description..." value={description} onChange={e => setDescription(e.target.value)} />
                                </div>
                                <Tabs defaultValue="file" onValueChange={(v) => setResourceType(v as any)}>
                                    <TabsList className="grid w-full grid-cols-2">
                                        <TabsTrigger value="file"><Upload className="mr-2 h-4 w-4" /> File</TabsTrigger>
                                        <TabsTrigger value="link"><LinkIcon className="mr-2 h-4 w-4" /> Link</TabsTrigger>
                                    </TabsList>
                                    <TabsContent value="file" className="pt-4">
                                        <Input type="file" onChange={(e) => setResourceFile(e.target.files?.[0] || null)} required={resourceType==='file'}/>
                                    </TabsContent>
                                    <TabsContent value="link" className="pt-4">
                                        <Input type="url" placeholder="https://..." value={resourceLink} onChange={e => setResourceLink(e.target.value)} required={resourceType==='link'} />
                                    </TabsContent>
                                </Tabs>
                            </div>
                            <DialogFooter>
                                <DialogClose asChild><Button variant="outline" type="button">Cancel</Button></DialogClose>
                                <Button type="submit" disabled={formLoading}>
                                    {formLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Add Resource'}
                                </Button>
                            </DialogFooter>
                        </form></DialogContent>
                    </Dialog>
                )}
            </CardHeader>
            <CardContent>
                {resources.length > 0 ? (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {resources.map(r => (
                            <Card key={r.id} className="flex flex-col justify-between">
                                <CardHeader>
                                    <div className="flex items-center gap-2">
                                        {r.type === 'file' ? <FileText className="h-5 w-5 text-primary" /> : <Globe className="h-5 w-5 text-primary" />}
                                        <CardTitle className="text-base truncate">{r.title}</CardTitle>
                                    </div>
                                    <CardDescription className="line-clamp-2">{r.description}</CardDescription>
                                </CardHeader>
                                <CardFooter className="bg-muted/50 p-3 flex justify-between items-center">
                                    <Button asChild variant="link" size="sm" className="px-0">
                                        <a href={r.url} target="_blank" rel="noopener noreferrer" className="flex items-center">
                                            <Download className="mr-2 h-4 w-4"/> 
                                            {r.type === 'file' ? 'Download' : 'Open Link'}
                                        </a>
                                    </Button>
                                    {isAuthorized && (
                                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(r.id)}>
                                            <Trash2 className="h-4 w-4"/>
                                        </Button>
                                    )}
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                        <p>No resources added yet.</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
