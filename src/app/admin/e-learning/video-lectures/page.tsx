
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, Link as LinkIcon, Trash2, Video } from "lucide-react";
import { db, storage } from '@/lib/firebase';
import { ref, onValue, set, push, remove } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Course = { id: string; name: string; code: string; };
type Resource = { id: string; title: string; url: string; type: 'video' | 'video-link'; fileName?: string; };

export default function VideoLecturesPage() {
    const [courses, setCourses] = React.useState<Course[]>([]);
    const [selectedCourse, setSelectedCourse] = React.useState('');
    const [resources, setResources] = React.useState<Resource[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [file, setFile] = React.useState<File | null>(null);
    const [link, setLink] = React.useState('');
    const [title, setTitle] = React.useState('');
    const [activeTab, setActiveTab] = React.useState('file');
    const { toast } = useToast();

    React.useEffect(() => {
        const coursesRef = ref(db, 'courses');
        const unsub = onValue(coursesRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                setCourses(Object.keys(data).map(id => ({ id, ...data[id] })));
            }
            setLoading(false);
        });
        return () => unsub();
    }, []);

    React.useEffect(() => {
        if (!selectedCourse) {
            setResources([]);
            return;
        }
        const resourcesRef = ref(db, `resources/${selectedCourse}`);
        const unsub = onValue(resourcesRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                const videoResources = Object.keys(data)
                    .map(id => ({ id, ...data[id] }))
                    .filter(res => res.type === 'video' || res.type === 'video-link');
                setResources(videoResources);
            } else {
                setResources([]);
            }
        });
        return () => unsub();
    }, [selectedCourse]);

    const handleSave = async () => {
        if (!selectedCourse || !title) {
            toast({ variant: 'destructive', title: 'Please select a course and enter a title.' });
            return;
        }
        if (activeTab === 'file' && !file) {
            toast({ variant: 'destructive', title: 'Please select a video file to upload.' });
            return;
        }
        if (activeTab === 'link' && !link) {
            toast({ variant: 'destructive', title: 'Please enter a video link.' });
            return;
        }

        setSaving(true);
        try {
            let resourceUrl = link;
            let fileName = undefined;
            if (activeTab === 'file' && file) {
                const fileStorageRef = storageRef(storage, `resources/${selectedCourse}/${Date.now()}_${file.name}`);
                const snapshot = await uploadBytes(fileStorageRef, file);
                resourceUrl = await getDownloadURL(snapshot.ref);
                fileName = file.name;
            }

            await push(ref(db, `resources/${selectedCourse}`), { 
                title, 
                url: resourceUrl, 
                fileName, 
                type: activeTab === 'file' ? 'video' : 'video-link' 
            });
            toast({ title: 'Video resource added successfully' });
            setFile(null);
            setTitle('');
            setLink('');
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Operation failed', description: e.message });
        } finally {
            setSaving(false);
        }
    };
    
    const handleDelete = async (resourceId: string) => {
        if(!window.confirm("Are you sure?")) return;
        await remove(ref(db, `resources/${selectedCourse}/${resourceId}`));
        toast({title: "Resource deleted"});
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Video Lectures</CardTitle>
                <CardDescription>Upload video files or link to external videos (e.g., YouTube, Vimeo).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label>Course</Label>
                    <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                        <SelectTrigger><SelectValue placeholder="Select a course..." /></SelectTrigger>
                        <SelectContent>
                            {courses.map(c => <SelectItem key={c.id} value={c.id}>{c.name} ({c.code})</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                {selectedCourse && (
                    <div className="p-4 border rounded-lg space-y-4">
                         <h3 className="font-semibold">Add New Video Resource</h3>
                         <div className="space-y-1">
                            <Label htmlFor="title">Video Title</Label>
                            <Input id="title" value={title} onChange={e => setTitle(e.target.value)} />
                         </div>
                        <Tabs value={activeTab} onValueChange={setActiveTab}>
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="file"><Upload className="mr-2 h-4 w-4" /> Upload File</TabsTrigger>
                                <TabsTrigger value="link"><LinkIcon className="mr-2 h-4 w-4" /> Add Link</TabsTrigger>
                            </TabsList>
                            <TabsContent value="file" className="pt-4">
                                <Input id="file" type="file" accept="video/*" onChange={e => setFile(e.target.files?.[0] || null)} />
                            </TabsContent>
                            <TabsContent value="link" className="pt-4">
                                <Input id="link" type="url" placeholder="https://youtube.com/watch?v=..." value={link} onChange={e => setLink(e.target.value)} />
                            </TabsContent>
                        </Tabs>
                        <Button onClick={handleSave} disabled={saving}>
                            {saving ? <Loader2 className="mr-2 h-4 animate-spin"/> : <PlusCircle className="mr-2 h-4 w-4" />} Add Video
                        </Button>
                    </div>
                )}
                 {selectedCourse && (
                    <div className="p-4 border rounded-lg space-y-4">
                         <h3 className="font-semibold">Existing Videos</h3>
                         <div className="space-y-2">
                            {resources.map(res => (
                                <div key={res.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted">
                                    <span className="flex items-center gap-2"><Video className="h-4 w-4" />{res.title}</span>
                                    <div className="flex gap-2">
                                        <Button asChild variant="outline" size="sm"><a href={res.url} target="_blank" rel="noopener noreferrer"><LinkIcon className="mr-2 h-4"/>Open</a></Button>
                                        <Button variant="ghost" size="icon" onClick={() => handleDelete(res.id)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                    </div>
                                </div>
                            ))}
                            {resources.length === 0 && <p className="text-sm text-muted-foreground">No videos found for this course.</p>}
                         </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
