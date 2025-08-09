
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileQuestion } from "lucide-react";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

export default function OnlineQuizzesPage() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Online Quizzes</CardTitle>
                <CardDescription>Create, manage, and review online quizzes for student assessment.</CardDescription>
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
                <p className="text-sm text-muted-foreground">This feature will allow for the creation of quizzes with various question types (multiple choice, true/false, etc.), time limits, and automatic grading.</p>
                <Button disabled><FileQuestion className="mr-2 h-4 w-4" /> Create New Quiz</Button>
            </CardContent>
        </Card>
    );
}
