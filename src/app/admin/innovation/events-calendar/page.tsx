
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';

export default function InnovationEventsCalendarPage() {
    const [date, setDate] = React.useState<Date | undefined>(new Date());

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Innovation Events Calendar</CardTitle>
                    <CardDescription>Manage and publish hackathons, workshops, and pitch competitions.</CardDescription>
                </div>
                <Button><PlusCircle className="mr-2 h-4 w-4"/> New Event</Button>
            </CardHeader>
            <CardContent>
                <div className="flex justify-center">
                 <CalendarComponent
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    className="rounded-md border"
                />
                </div>
                 <div className="mt-4">
                    <h3 className="font-semibold">Events for {date ? date.toLocaleDateString() : 'selected date'}:</h3>
                    <p className="text-sm text-muted-foreground mt-2">No innovation events scheduled for this date.</p>
                </div>
            </CardContent>
        </Card>
    );
}
