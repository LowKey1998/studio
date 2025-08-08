
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, MessageSquare } from "lucide-react";
import { Textarea } from '@/components/ui/textarea';

const mockIdeas = [
    { id: 1, author: 'Dr. Ellie Sattler', idea: 'A campus sustainability dashboard to track energy and water usage in real-time.' },
    { id: 2, author: 'Jane Doe', idea: 'A mobile app for students to trade or sell used textbooks.' },
];

export default function IdeaBoardPage() {
    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Startup Idea Board</CardTitle>
                    <CardDescription>A space for students and staff to post, view, and discuss new ideas.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-4">
                        <Textarea placeholder="Share a new idea..."/>
                        <Button><PlusCircle className="mr-2 h-4 w-4"/>Post Idea</Button>
                    </div>
                </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-6">
                {mockIdeas.map(idea => (
                    <Card key={idea.id}>
                        <CardHeader>
                            <CardDescription>Posted by {idea.author}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p>{idea.idea}</p>
                        </CardContent>
                        <CardFooter>
                            <Button variant="outline"><MessageSquare className="mr-2 h-4 w-4"/>Discuss</Button>
                        </CardFooter>
                    </Card>
                ))}
            </div>
        </div>
    );
}
