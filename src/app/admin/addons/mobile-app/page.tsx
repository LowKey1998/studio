'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Smartphone, Bell, MessageSquare, BookOpen } from 'lucide-react';
import Image from 'next/image';

export default function MobileAppPage() {
    return (
        <Card>
            <CardHeader className="text-center">
                <CardTitle className="font-headline text-3xl">Edutrack360 Mobile App</CardTitle>
                <CardDescription className="max-w-2xl mx-auto">Engage your students and staff on the go with a dedicated mobile application for iOS and Android.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
                <div className="flex justify-center">
                    <Image src="https://placehold.co/600x400.png" width={600} height={400} alt="Mobile App Showcase" className="rounded-lg shadow-lg" data-ai-hint="mobile app"/>
                </div>
                 <div className="grid md:grid-cols-3 gap-8 text-center">
                    <div className="space-y-2">
                        <div className="flex justify-center mb-2"><div className="bg-primary/10 rounded-full p-3"><Bell className="h-8 w-8 text-primary"/></div></div>
                        <h4 className="font-semibold">Push Notifications</h4>
                        <p className="text-sm text-muted-foreground">Keep everyone informed with instant notifications for announcements, grades, and deadlines.</p>
                    </div>
                     <div className="space-y-2">
                         <div className="flex justify-center mb-2"><div className="bg-primary/10 rounded-full p-3"><MessageSquare className="h-8 w-8 text-primary"/></div></div>
                        <h4 className="font-semibold">Mobile-First Communication</h4>
                        <p className="text-sm text-muted-foreground">Facilitate easy communication between students and lecturers through in-app messaging.</p>
                    </div>
                     <div className="space-y-2">
                        <div className="flex justify-center mb-2"><div className="bg-primary/10 rounded-full p-3"><BookOpen className="h-8 w-8 text-primary"/></div></div>
                        <h4 className="font-semibold">Access Anywhere</h4>
                        <p className="text-sm text-muted-foreground">Provide access to course materials, grades, timetables, and payments from anywhere, at any time.</p>
                    </div>
                </div>
                <div className="text-center pt-6">
                    <Button disabled>Inquire About Mobile App</Button>
                </div>
            </CardContent>
        </Card>
    );
}
