
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Search } from "lucide-react";
import { Input } from '@/components/ui/input';

const mockProfiles = [
    { id: 1, name: 'Jane Doe', skills: ['Frontend Dev', 'UI/UX Design'], lookingFor: 'Backend Developer' },
    { id: 2, name: 'John Smith', skills: ['Marketing', 'Business Strategy'], lookingFor: 'Technical Co-founder' },
    { id: 3, name: 'Richard Roe', skills: ['Python', 'Data Science'], lookingFor: 'Project Manager' },
];

export default function CollaborationPortalPage() {
    return (
        <div className="space-y-6">
             <Card>
                <CardHeader>
                    <CardTitle>Collaboration & Team Building Portal</CardTitle>
                    <CardDescription>Find collaborators for your projects based on skills and interests.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-2">
                        <Input placeholder="Search for skills (e.g., Python, Marketing)..."/>
                        <Button><Search className="mr-2 h-4 w-4"/>Search</Button>
                    </div>
                </CardContent>
            </Card>
             <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {mockProfiles.map(profile => (
                    <Card key={profile.id}>
                        <CardHeader>
                            <CardTitle>{profile.name}</CardTitle>
                            <CardDescription>Skills: {profile.skills.join(', ')}</CardDescription>
                        </CardHeader>
                         <CardContent>
                            <p className="text-sm font-semibold">Looking for:</p>
                            <p className="text-sm text-muted-foreground">{profile.lookingFor}</p>
                        </CardContent>
                        <CardFooter>
                            <Button className="w-full">Connect</Button>
                        </CardFooter>
                    </Card>
                ))}
            </div>
        </div>
    );
}
