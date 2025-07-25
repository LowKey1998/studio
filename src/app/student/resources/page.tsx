
"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, FileType, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { db } from '@/lib/firebase';
import { ref, onValue, off } from 'firebase/database';

interface Resource {
  id: string;
  title: string;
  description: string;
  fileUrl: string;
  fileType: string;
  category: string;
}

const ResourceItemSkeleton = () => (
    <li className="flex items-center justify-between p-4 border rounded-lg">
        <div className="flex items-center gap-4 w-full">
            <Skeleton className="h-8 w-8" />
            <div className="space-y-2 w-full">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <div className="flex items-center gap-2 mt-2">
                    <Skeleton className="h-5 w-20" />
                    <Skeleton className="h-5 w-16" />
                </div>
            </div>
        </div>
        <Skeleton className="h-10 w-28" />
    </li>
);

export default function ResourcesPage() {
    const [resources, setResources] = useState<Resource[]>([]);
    const [filteredResources, setFilteredResources] = useState<Resource[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const resourcesRef = ref(db, 'resources');

        const listener = onValue(resourcesRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const resourceList = Object.keys(data).map(key => ({
                    id: key,
                    ...data[key]
                }));
                setResources(resourceList);
                setFilteredResources(resourceList);
            } else {
                setResources([]);
                setFilteredResources([]);
            }
            setLoading(false);
        }, (error) => {
            console.error(error);
            setLoading(false);
        });

        return () => {
            off(resourcesRef, 'value', listener);
        };
    }, []);

    useEffect(() => {
        const results = resources.filter(resource =>
            resource.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            resource.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
            resource.category.toLowerCase().includes(searchTerm.toLowerCase())
        );
        setFilteredResources(results);
    }, [searchTerm, resources]);


  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Student Resources</CardTitle>
          <CardDescription>Find and download important documents, forms, and course materials.</CardDescription>
        </CardHeader>
        <CardContent>
             <div className="mb-6">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input 
                        placeholder="Search by title, description, or category..." 
                        className="pl-10"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>
            
          <ul className="space-y-4">
            {loading ? (
                Array.from({length: 4}).map((_, i) => <ResourceItemSkeleton key={i} />)
            ) : filteredResources.length > 0 ? (
                filteredResources.map((resource) => (
                    <li key={resource.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-secondary/50 transition-colors">
                        <div className="flex items-center gap-4">
                        <FileType className="h-8 w-8 text-primary" />
                        <div>
                            <h3 className="font-semibold">{resource.title}</h3>
                            <p className="text-sm text-muted-foreground">{resource.description}</p>
                            <div className="flex items-center gap-2 mt-2">
                                <Badge variant="outline">{resource.category}</Badge>
                                <Badge variant="secondary">{resource.fileType}</Badge>
                            </div>
                        </div>
                        </div>
                        <Button asChild>
                        <a href={resource.fileUrl} target="_blank" rel="noopener noreferrer" download>
                            <Download className="mr-2 h-4 w-4" />
                            Download
                        </a>
                        </Button>
                    </li>
                ))
            ) : (
                 <div className="col-span-full text-center py-10">
                    <p className="text-muted-foreground">No resources found. The catalog is currently empty.</p>
                </div>
            )}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
