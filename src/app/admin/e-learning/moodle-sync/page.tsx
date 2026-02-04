
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Info } from "lucide-react";

export default function MoodleSyncPage() {
    return (
        <div className="space-y-6">
            <div className="bg-yellow-50 border-2 border-orange-500 rounded-lg p-4 flex gap-3 items-start">
                <Info className="h-5 w-5 text-orange-600 mt-0.5" />
                <div>
                    <h4 className="font-bold text-orange-800">Integration Pending</h4>
                    <p className="text-orange-700 text-sm">
                        The Moodle API connection module is currently being finalized. Please contact the technical team to enable this bridge for your instance.
                    </p>
                </div>
            </div>

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
        </div>
    );
}
