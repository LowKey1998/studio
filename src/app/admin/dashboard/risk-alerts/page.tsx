'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from '@/components/ui/skeleton';
import { db } from '@/lib/firebase';
import { ref, get } from 'firebase/database';
import { AlertTriangle, TrendingDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

type AtRiskStudent = {
    userId: string;
    studentId: string;
    studentName: string;
    programmeName: string;
    failedCourses: { code: string; name: string }[];
    riskLevel: 'High' | 'Medium' | 'Low';
};

export default function RiskAlertsDashboardPage() {
    const [atRiskStudents, setAtRiskStudents] = React.useState<AtRiskStudent[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [searchTerm, setSearchTerm] = React.useState('');

    React.useEffect(() => {
        const fetchRiskData = async () => {
            setLoading(true);
            try {
                const [usersSnap, assessmentsSnap, coursesSnap, programmesSnap] = await Promise.all([
                    get(ref(db, 'users')),
                    get(ref(db, 'assessments')),
                    get(ref(db, 'courses')),
                    get(ref(db, 'programmes'))
                ]);

                if (!usersSnap.exists() || !assessmentsSnap.exists() || !coursesSnap.exists()) {
                    setLoading(false); return;
                }

                const users = usersSnap.val();
                const assessmentsBySemester = assessmentsSnap.val();
                const courses = coursesSnap.val();
                const programmes = programmesSnap.val() || {};

                const riskList: AtRiskStudent[] = [];

                for (const userId in users) {
                    if (users[userId].role !== 'Student') continue;

                    const failedCourses: { code: string; name: string }[] = [];
                    const foundCourseIds = new Set<string>();

                    // Iterate through semesters then courses to find failures
                    for (const semId in assessmentsBySemester) {
                        for (const courseId in assessmentsBySemester[semId]) {
                            const scores = assessmentsBySemester[semId][courseId][userId];
                            if (scores?.finalExam?.score !== undefined && scores.finalExam.score < 50) {
                                if (!foundCourseIds.has(courseId)) {
                                    failedCourses.push({
                                        code: courses[courseId]?.code || 'N/A',
                                        name: courses[courseId]?.name || 'Unknown'
                                    });
                                    foundCourseIds.add(courseId);
                                }
                            }
                        }
                    }

                    if (failedCourses.length > 0) {
                        let riskLevel: AtRiskStudent['riskLevel'] = 'Low';
                        if (failedCourses.length > 2) riskLevel = 'High';
                        else if (failedCourses.length > 1) riskLevel = 'Medium';
                        
                        riskList.push({
                            userId,
                            studentId: users[userId].id,
                            studentName: users[userId].name,
                            programmeName: programmes[users[userId].programmeId]?.name || 'N/A',
                            failedCourses,
                            riskLevel,
                        });
                    }
                }
                setAtRiskStudents(riskList.sort((a,b) => b.failedCourses.length - a.failedCourses.length));
            } catch (error) {
                console.error("Error fetching academic risk data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchRiskData();
    }, []);
    
    const filteredStudents = atRiskStudents.filter(s => 
        s.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.studentId.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    const riskVariant: Record<AtRiskStudent['riskLevel'], 'destructive' | 'secondary' | 'outline'> = {
        'High': 'destructive',
        'Medium': 'secondary',
        'Low': 'outline'
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><AlertTriangle /> Academic Risk Alerts</CardTitle>
                <CardDescription>Students who may be at risk of falling behind based on past course failures.</CardDescription>
                <div className="relative pt-2">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search by student name or ID..." className="pl-8" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Student ID</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Programme</TableHead>
                            <TableHead className="text-center">Failed Courses</TableHead>
                            <TableHead>Risk Level</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? Array.from({length: 5}).map((_, i) => (
                            <TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                        )) : filteredStudents.map(student => (
                            <TableRow key={student.userId}>
                                <TableCell>{student.studentId}</TableCell>
                                <TableCell className="font-medium">{student.studentName}</TableCell>
                                <TableCell>{student.programmeName}</TableCell>
                                <TableCell className="text-center">{student.failedCourses.length}</TableCell>
                                <TableCell>
                                    <Badge variant={riskVariant[student.riskLevel]}>{student.riskLevel}</Badge>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
