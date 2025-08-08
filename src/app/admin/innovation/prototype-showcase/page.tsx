
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import Image from 'next/image';
import { Button } from '@/components/ui/button';

const mockPrototypes = [
    { id: 1, title: 'AI Chatbot UI', student: 'Jane Doe', imageUrl: 'https://placehold.co/600x400.png', hint: 'chatbot interface' },
    { id: 2, title: 'Irrigation System Sensor', student: 'John Smith', imageUrl: 'https://placehold.co/600x400.png', hint: 'sensor device' },
];

export default function PrototypeShowcasePage() {
    return (
        <div className="space-y-6">
            <Card className="border-0 shadow-none">
                 <CardHeader>
                    <CardTitle>Prototype Showcase</CardTitle>
                    <CardDescription>A gallery of submitted student project prototypes.</CardDescription>
                </CardHeader>
            </Card>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {mockPrototypes.map(proto => (
                    <Card key={proto.id}>
                         <CardContent className="p-0">
                             <Image src={proto.imageUrl} alt={proto.title} width={600} height={400} className="rounded-t-lg object-cover" data-ai-hint={proto.hint}/>
                         </CardContent>
                         <CardHeader>
                             <CardTitle>{proto.title}</CardTitle>
                            <CardDescription>by {proto.student}</CardDescription>
                         </CardHeader>
                         <CardFooter>
                            <Button variant="outline" className="w-full">View Details</Button>
                         </CardFooter>
                    </Card>
                ))}
            </div>
        </div>
    );
}
