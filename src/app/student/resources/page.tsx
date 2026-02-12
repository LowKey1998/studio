'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Download, Calendar, BookUser, Info, ShieldCheck, FileDown } from "lucide-react";
import { db } from '@/lib/firebase';
import { ref, get, onValue } from 'firebase/database';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

type GeneralResource = {
    id: string;
    title: string;
    description: string;
    type: string;
    fileUrl: string;
}

const typeMap: Record<string, { label: string, icon: React.ReactNode }> = {
    'handbook': { label: 'Student Handbook', icon: <BookUser className="h-8 w-8 text-primary" /> },
    'policy': { label: 'Academic Policy', icon: <ShieldCheck className="h-8 w-8 text-primary" /> },
    'calendar': { label: 'Academic Calendar', icon: <Calendar className="h-8 w-8 text-primary" /> },
    'other': { label: 'Information', icon: <FileText className="h-8 w-8 text-primary" /> },
};

export default function ResourcesPage() {
  const [resources, setResources] = React.useState<GeneralResource[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    setLoading(true);
    const resourcesRef = ref(db, 'generalResources');
    const unsub = onValue(resourcesRef, (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.val();
            const list: GeneralResource[] = Object.keys(data).map(id => ({ id, ...data[id] }));
            setResources(list);
        } else {
            setResources([]);
        }
        setLoading(false);
    });
    return () => unsub();
  }, []);

  return (
    <div className="space-y-6">
      <Card className="shadow-lg border-0 bg-primary/5">
        <CardHeader>
          <div className="flex items-center gap-2">
            <BookUser className="h-6 w-6 text-primary" />
            <CardTitle className="font-headline text-2xl">Official Resources & Policies</CardTitle>
          </div>
          <CardDescription>Download the latest handbooks, academic calendars, and institutional policy documents.</CardDescription>
        </CardHeader>
      </Card>
    
    {loading ? (
         <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
             {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-64 w-full rounded-xl" />)}
        </div>
    ): resources.length > 0 ? (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {resources.map((resource) => {
          const typeInfo = typeMap[resource.type.toLowerCase()] || typeMap['other'];
          return (
            <Card key={resource.id} className="flex flex-col shadow-lg hover:shadow-xl transition-all border-t-4 border-t-primary/20 hover:border-t-primary">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 shadow-inner">
                      {typeInfo.icon}
                  </div>
                   <Badge variant="outline" className="bg-background/50 backdrop-blur-sm font-bold uppercase text-[9px]">{typeInfo.label}</Badge>
                </div>
                <CardTitle className="pt-4 font-headline text-lg leading-tight">{resource.title}</CardTitle>
              </CardHeader>
              <CardContent className="flex-grow">
                <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">{resource.description}</p>
              </CardContent>
              <CardFooter className="bg-muted/10 border-t p-4">
                <Button className="w-full shadow-sm group" asChild>
                  <a href={resource.fileUrl} target="_blank" rel="noopener noreferrer">
                      <FileDown className="mr-2 h-4 w-4 transition-transform group-hover:translate-y-0.5" />
                      Download PDF
                  </a>
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    ) : (
         <Card className="bg-muted/20 border-dashed border-2">
            <CardContent className="pt-12 pb-12 flex flex-col items-center text-center">
                <Info className="h-12 w-12 text-muted-foreground opacity-20 mb-4" />
                <h3 className="text-lg font-semibold">No Resources Available</h3>
                <p className="text-sm text-muted-foreground max-w-xs">
                    The administration has not yet published any general documents for this academic cycle.
                </p>
            </CardContent>
        </Card>
    )}
    </div>
  );
}
