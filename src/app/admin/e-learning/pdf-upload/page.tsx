
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, Link as LinkIcon, Trash2, Download } from "lucide-react";
import { db, storage } from '@/lib/firebase';
import { ref, onValue, set, push, remove } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Course = { id: string; name: string; code: string; };
type Resource = { id: string; title: string; url: string; fileName?: string; };

export default function PdfUploadPage() {
    const [courses, setCourses] = React.useState<Course[]>([]);
    const [selectedCourse, setSelectedCourse] = React.useState('');
    const [resources, setResources] = React.useState<Resource[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [file, setFile] = React.useState<File | null>(null);
    const [title, setTitle] = React.useState('');
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
                setResources(Object.keys(data).map(id => ({ id, ...data[id] })));
            } else {
                setResources([]);
            }
        });
        return () => unsub();
    }, [selectedCourse]);

    const handleUpload = async () => {
        if (!selectedCourse || !file || !title) {
            toast({ variant: 'destructive', title: 'Please select a course, title, and file.' });
            return;
        }
        setSaving(true);
        try {
            const fileStorageRef = storageRef(storage, `resources/${selectedCourse}/${Date.now()}_${file.name}`);
            const snapshot = await uploadBytes(fileStorageRef, file);
            const url = await getDownloadURL(snapshot.ref);

            await push(ref(db, `resources/${selectedCourse}`), { title, url, fileName: file.name, type: 'file' });
            toast({ title: 'File uploaded successfully' });
            setFile(null);
            setTitle('');
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Upload failed', description: e.message });
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
                <CardTitle>PDF Upload</CardTitle>
                <CardDescription>Upload and manage PDF learning materials for various courses.</CardDescription>
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
                         <h3 className="font-semibold">Upload New PDF</h3>
                         <div className="space-y-1">
                            <Label htmlFor="title">Document Title</Label>
                            <Input id="title" value={title} onChange={e => setTitle(e.target.value)} />
                         </div>
                         <div className="space-y-1">
                            <Label htmlFor="file">PDF File</Label>
                            <Input id="file" type="file" accept=".pdf" onChange={e => setFile(e.target.files?.[0] || null)} />
                        </div>
                        <Button onClick={handleUpload} disabled={saving}>
                            {saving ? <Loader2 className="mr-2 h-4 animate-spin"/> : <Upload className="mr-2 h-4 w-4" />} Upload PDF
                        </Button>
                    </div>
                )}
                 {selectedCourse && (
                    <div className="p-4 border rounded-lg space-y-4">
                         <h3 className="font-semibold">Existing Resources</h3>
                         <div className="space-y-2">
                            {resources.map(res => (
                                <div key={res.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted">
                                    <span>{res.title}</span>
                                    <div className="flex gap-2">
                                        <Button asChild variant="outline" size="sm">
                                            <a href={res.url} target="_blank" rel="noopener noreferrer">
                                                <Download className="mr-2 h-4"/>Download
                                            </a>
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={() => handleDelete(res.id)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                    </div>
                                </div>
                            ))}
                            {resources.length === 0 && <p className="text-sm text-muted-foreground">No resources found for this course.</p>}
                         </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
