
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from '@/components/ui/skeleton';
import { db } from '@/lib/firebase';
import { ref, get } from 'firebase/database';
import { TrendingDown } from 'lucide-react';

type DropoutData = {
    name: string; // Programme or Intake name
    initial: number;
    current: number;
    dropoutRate: number;
};

export default function DropoutTrendsPage() {
    const [dropoutByProgramme, setDropoutByProgramme] = React.useState<DropoutData[]>([]);
    const [dropoutByIntake, setDropoutByIntake] = React.useState<DropoutData[]>([]);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        const fetchDropoutData = async () => {
            setLoading(true);
            try {
                const [usersSnap, programmesSnap, intakesSnap] = await Promise.all([
                    get(ref(db, 'users')),
                    get(ref(db, 'programmes')),
                    get(ref(db, 'intakes'))
                ]);

                if (!usersSnap.exists()) {
                    setLoading(false); return;
                }

                const users = usersSnap.val();
                const programmes = programmesSnap.val() || {};
                const intakes = intakesSnap.val() || {};
                
                const programmeStats: Record<string, { initial: number, current: number }> = {};
                const intakeStats: Record<string, { initial: number, current: number }> = {};

                for (const uid in users) {
                    const user = users[uid];
                    if (user.role !== 'Student') continue;

                    if (user.programmeId) {
                        if (!programmeStats[user.programmeId]) programmeStats[user.programmeId] = { initial: 0, current: 0 };
                        programmeStats[user.programmeId].initial++;
                        if (user.status !== 'disabled') { // Assuming 'disabled' can signify dropout
                             programmeStats[user.programmeId].current++;
                        }
                    }
                    if (user.intakeId) {
                         if (!intakeStats[user.intakeId]) intakeStats[user.intakeId] = { initial: 0, current: 0 };
                        intakeStats[user.intakeId].initial++;
                        if (user.status !== 'disabled') {
                            intakeStats[user.intakeId].current++;
                        }
                    }
                }
                
                const calculateDropout = (stats: { initial: number, current: number }) => {
                    return stats.initial > 0 ? ((stats.initial - stats.current) / stats.initial) * 100 : 0;
                };

                setDropoutByProgramme(
                    Object.entries(programmeStats).map(([id, stats]) => ({
                        name: programmes[id]?.name || `Unknown (${id})`, ...stats, dropoutRate: calculateDropout(stats)
                    })).sort((a,b) => b.dropoutRate - a.dropoutRate)
                );
                
                 setDropoutByIntake(
                    Object.entries(intakeStats).map(([id, stats]) => ({
                        name: intakes[id]?.name || `Unknown (${id})`, ...stats, dropoutRate: calculateDropout(stats)
                    })).sort((a,b) => b.dropoutRate - a.dropoutRate)
                );

            } catch (error) {
                console.error("Error fetching dropout data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchDropoutData();
    }, []);

    const renderTable = (data: DropoutData[], title: string, col1Header: string) => (
        <Card>
            <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>{col1Header}</TableHead>
                            <TableHead className="text-center">Initial Count</TableHead>
                            <TableHead className="text-center">Current Count</TableHead>
                            <TableHead className="text-right">Dropout Rate</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                         {loading ? Array.from({length: 3}).map((_, i) => (
                            <TableRow key={i}><TableCell colSpan={4}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                        )) : data.map((item, i) => (
                            <TableRow key={i}>
                                <TableCell>{item.name}</TableCell>
                                <TableCell className="text-center">{item.initial}</TableCell>
                                <TableCell className="text-center">{item.current}</TableCell>
                                <TableCell className="text-right font-semibold">{item.dropoutRate.toFixed(1)}%</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><TrendingDown /> Dropout Trends</CardTitle>
                    <CardDescription>Analysis of student dropout rates by programme and intake. Dropouts are estimated based on disabled student accounts.</CardDescription>
                </CardHeader>
            </Card>

            <div className="grid gap-6 md:grid-cols-2">
                {renderTable(dropoutByProgramme, "Dropout Rate by Programme", "Programme")}
                {renderTable(dropoutByIntake, "Dropout Rate by Intake", "Intake")}
            </div>
        </div>
    );
}
