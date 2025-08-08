
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";

export default function AssignmentsUploadPage() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Assignments Upload & Management</CardTitle>
                <CardDescription>Create assignment dropboxes and manage student submissions.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">This page will enable lecturers and admins to create assignments, set due dates, and view student submissions.</p>
                <Button disabled><Upload className="mr-2 h-4 w-4" /> Create Assignment</Button>
            </CardContent>
        </Card>
    );
}
