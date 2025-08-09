
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

export default function DiscussionForumsPage() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Discussion Forums</CardTitle>
                <CardDescription>Create and moderate course-specific discussion forums.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label>Course</Label>
                    <Select>
                        <SelectTrigger><SelectValue placeholder="Select a course..." /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="loading">Loading courses...</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <p className="text-sm text-muted-foreground">This module will allow for threaded discussions where students and lecturers can interact, ask questions, and collaborate.</p>
                <Button disabled><MessageSquare className="mr-2 h-4 w-4" /> New Forum</Button>
            </CardContent>
        </Card>
    );
}
