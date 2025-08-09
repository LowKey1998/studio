
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
                <CardDescription>This feature is now managed within each course page for staff and students.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                 <p className="text-sm text-muted-foreground">To view or manage a discussion forum, please navigate to the desired course via the "My Courses" page for staff or "My Classes" for students, and select the "Messages" tab.</p>
            </CardContent>
        </Card>
    );
}
