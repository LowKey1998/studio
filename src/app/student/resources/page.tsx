
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Download, Calendar, BookUser, Info } from "lucide-react";
import { db } from '@/lib/firebase';
import { ref, get } from 'firebase/database';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

type GeneralResource = {
    id: string;
    title: string;
    description: string;
    type: string;
    fileUrl: string;
}

export default function ResourcesPage() {
  const [resources, setResources] = React.useState<GeneralResource[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchResources = async () => {
        setLoading(true);
        const resourcesRef = ref(db, 'generalResources');
        const snapshot = await get(resourcesRef);
        if (snapshot.exists()) {
            const data = snapshot.val();
            const list: GeneralResource[] = Object.keys(data).map(id => ({ id, ...data[id] }));
            setResources(list);
        }
        setLoading(false);
    };
    fetchResources();
  }, []);

  const getIcon = (type: string) => {
    switch(type.toLowerCase()){
        case 'pdf': return <FileText className="h-8 w-8 text-primary" />;
        case 'handbook': return <BookUser className="h-8 w-8 text-primary" />;
        case 'calendar': return <Calendar className="h-8 w-8 text-primary" />;
        default: return <FileText className="h-8 w-8 text-primary" />;
    }
  }


  return (
    <div className="space-y-6">
      <Card className="shadow-lg border-0">
        <CardHeader>
          <CardTitle className="font-headline text-2xl">School Resources</CardTitle>
          <CardDescription>Find and download important documents, forms, and guides.</CardDescription>
        </CardHeader>
      </Card>
    
    {loading ? (
         <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
             {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-64 w-full" />)}
        </div>
    ): resources.length > 0 ? (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {resources.map((resource) => (
          <Card key={resource.id} className="flex flex-col shadow-lg transition-transform duration-300 hover:-translate-y-1">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent">
                    {getIcon(resource.type)}
                </div>
                 <Badge variant="outline">{resource.type}</Badge>
              </div>
              <CardTitle className="pt-4 font-headline text-lg">{resource.title}</CardTitle>
            </CardHeader>
            <CardContent className="flex-grow">
              <p className="text-sm text-muted-foreground">{resource.description}</p>
            </CardContent>
            <CardFooter>
              <Button className="w-full" asChild>
                <a href={resource.fileUrl} target="_blank" rel="noopener noreferrer">
                    <Download className="mr-2 h-4 w-4" />
                    Download
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
                    <Info className="h-4 w-4" />
                    <AlertTitle>No Resources Found</AlertTitle>
                    <AlertDescription>
                        There are no general school resources available at this time.
                    </AlertDescription>
                </Alert>
            </CardContent>
        </Card>
    )}
    </div>
  );
}
