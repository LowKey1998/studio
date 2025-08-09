
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Video } from "lucide-react";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

export default function VideoLecturesPage() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Video Lectures</CardTitle>
                <CardDescription>Manage and link to video lecture content.</CardDescription>
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
                <p className="text-sm text-muted-foreground">This page will provide an interface to upload video files or link to external video platforms (like YouTube or Vimeo) for lecture recordings.</p>
                <Button disabled><Video className="mr-2 h-4 w-4" /> Add Video Lecture</Button>
            </CardContent>
        </Card>
    );
}
