
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

export default function MoodleSyncPage() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Moodle Synchronization</CardTitle>
                <CardDescription>Connect and synchronize data with an existing Moodle instance.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">This section will contain settings for connecting to a Moodle API, allowing for the synchronization of courses, users, and grades between the two platforms.</p>
                <Button disabled><RefreshCw className="mr-2 h-4 w-4" /> Configure & Sync</Button>
            </CardContent>
        </Card>
    );
}
