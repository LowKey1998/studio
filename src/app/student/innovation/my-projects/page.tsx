'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, PlusCircle } from "lucide-react";

const mockProjects = [
    { id: 'PROJ-001', title: 'AI-Powered Student Support Chatbot', status: 'Pending Review' },
    { id: 'PROJ-002', title: 'Sustainable Campus Irrigation System', status: 'Approved' },
];

export default function MyProjectsPage() {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="font-headline text-2xl">My Innovation Projects</CardTitle>
                    <CardDescription>Track the status of your submitted innovation projects.</CardDescription>
                </div>
                <Button><PlusCircle className="mr-2 h-4 w-4"/> Submit New Project</Button>
            </CardHeader>
            <CardContent>
                {mockProjects.length > 0 ? (
                     <div className="space-y-4">
                        {mockProjects.map(project => (
                            <Card key={project.id}>
                                <CardHeader className="flex-row justify-between items-center">
                                    <CardTitle className="text-lg">{project.title}</CardTitle>
                                    <Badge variant={project.status === 'Approved' ? 'default' : 'secondary'}>{project.status}</Badge>
                                </CardHeader>
                            </Card>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-16 text-muted-foreground">
                        <Lightbulb className="mx-auto h-12 w-12" />
                        <h3 className="mt-4 text-lg font-semibold">No Projects Yet</h3>
                        <p className="mt-2 text-sm">You haven't submitted any innovation projects.</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
