'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Link as LinkIcon, Upload, Folder } from "lucide-react";
import { db, auth } from '@/lib/firebase';
import { ref, onValue } from 'firebase/database';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useParams } from 'next/navigation';

type Resource = { 
    id: string; 
    title: string; 
    description: string; 
    type: 'file' | 'link'; 
    url: string; 
    fileName?: string;
};

export default function StudentResourcesPage() {
    const params = useParams();
    const courseId = params.courseId as string;
    const [resources, setResources] = React.useState<Resource[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [currentUser, setCurrentUser] = React.useState<User | null>(null);

    React.useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
          if (user) {
            setCurrentUser(user);
          } else {
            setLoading(false);
          }
        });
        return () => unsubscribeAuth();
      }, []);
    
    React.useEffect(() => {
        if (!currentUser || !courseId) return;
        
        const resourcesRef = ref(db, `resources/${courseId}`);
        const unsubscribe = onValue(resourcesRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                setResources(Object.keys(data).map(id => ({ id, ...data[id] })));
            } else {
                setResources([]);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, [courseId, currentUser]);
    
    if(loading) {
        return (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                 {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-56 w-full" />)}
            </div>
        );
    }
    
    return (
        <div className="space-y-6">
            {resources.length > 0 ? (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {resources.map((resource) => (
                    <Card key={resource.id} className="flex flex-col shadow-lg">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                {resource.type === 'file' ? <Upload className="h-5 w-5"/> : <LinkIcon className="h-5 w-5"/>}
                                {resource.title}
                            </CardTitle>
                            <CardDescription>{resource.description}</CardDescription>
                        </CardHeader>
                        <CardContent className="flex-grow">
                             <a href={resource.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all text-sm">
                                {resource.fileName || resource.url}
                            </a>
                        </CardContent>
                        <CardFooter>
                            <Button asChild className="w-full">
                                <a href={resource.url} target="_blank" rel="noopener noreferrer" download={resource.fileName}>
                                <Download className="mr-2 h-4 w-4" />
                                {resource.type === 'file' ? 'Download' : 'Open Link'}
                                </a>
                            </Button>
                        </CardFooter>
                    </Card>
                    ))}
                </div>
            ) : (
                <Card>
                    <CardContent className="pt-6">
                        <Alert>
                            <Folder className="h-4 w-4" />
                            <AlertTitle>No Resources Available</AlertTitle>
                            <AlertDescription>
                                The lecturer has not added any resources for this course yet.
                            </AlertDescription>
                        </Alert>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
