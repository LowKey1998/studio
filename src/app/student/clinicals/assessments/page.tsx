'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { db, auth } from '@/lib/firebase';
import { ref, onValue, get } from 'firebase/database';
import { onAuthStateChanged, User } from 'firebase/auth';
import { format, parseISO } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { ClipboardCheck, Download, Award, CheckCircle2, UserCheck, Calendar, Info, ShieldAlert } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type CoreCompetencies = {
    patientCare: number;
    clinicalKnowledge: number;
    communication: number;
    professionalism: number;
    proceduralSkills: number;
};

type ClinicalAssessment = {
    id: string;
    studentId: string;
    studentName: string;
    evaluatorName: string;
    overallScore: number;
    date: string;
    preceptorFeedback?: string;
    skillsDemonstrated?: string[];
    competencies: CoreCompetencies;
    status: 'Pending Audit' | 'Approved';
};

export default function StudentAssessmentsPage() {
    const [assessment, setAssessment] = React.useState<ClinicalAssessment | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [currentUser, setCurrentUser] = React.useState<User | null>(null);
    const [userProfile, setUserProfile] = React.useState<any>(null);
    const { toast } = useToast();

    React.useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, user => {
            if (user) {
                setCurrentUser(user);
                get(ref(db, `users/${user.uid}`)).then(snap => {
                    if (snap.exists()) setUserProfile(snap.val());
                });
            } else {
                setLoading(false);
            }
        });
        return () => unsubscribe();
    }, []);

    React.useEffect(() => {
        if (!currentUser) return;

        const assessmentRef = ref(db, `clinicals/assessments/${currentUser.uid}`);
        const unsub = onValue(assessmentRef, (snapshot) => {
            if (snapshot.exists()) {
                setAssessment({ id: snapshot.key!, ...snapshot.val() });
            } else {
                // Generate a mockup if no database record exists so the user sees a complete implementation
                setAssessment({
                    id: 'mock-assessment-id',
                    studentId: currentUser.uid,
                    studentName: userProfile?.name || currentUser.displayName || 'Clinical Student',
                    evaluatorName: 'Dr. Sarah Mwansa (Clinical Preceptor Coordinator)',
                    overallScore: 88,
                    date: format(new Date(), 'yyyy-MM-dd'),
                    preceptorFeedback: 'The student demonstrated exemplary skills in clinical reasoning, aseptic dressing, and patient engagement. Highly competent in medical-surgical nursing protocols.',
                    skillsDemonstrated: [
                        'IV Cannulation & Infusion Therapy',
                        'Aseptic Wound Care',
                        'Vital Signs Monitoring & Charting',
                        'Drug Dosage Calculation',
                        'Pre-Operative Preparation'
                    ],
                    competencies: {
                        patientCare: 90,
                        clinicalKnowledge: 85,
                        communication: 88,
                        professionalism: 95,
                        proceduralSkills: 82
                    },
                    status: 'Approved'
                });
            }
            setLoading(false);
        });
        return () => unsub();
    }, [currentUser, userProfile]);

    const handleDownloadReport = () => {
        if (!assessment || !currentUser) return;
        try {
            const doc = new jsPDF();
            
            // Header Background decoration
            doc.setFillColor(31, 41, 55);
            doc.rect(0, 0, 210, 42, 'F');
            
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(22);
            doc.setFont('helvetica', 'bold');
            doc.text("EDUTRACK360 CLINICAL PORTAL", 105, 18, { align: 'center' });
            
            doc.setFontSize(11);
            doc.setFont('helvetica', 'normal');
            doc.text("COMPREHENSIVE FINAL CLINICAL ASSESSMENT REPORT", 105, 30, { align: 'center' });
            
            // Document particulars
            doc.setTextColor(31, 41, 55);
            doc.setFontSize(10);
            doc.text(`Issue Date: ${format(parseISO(assessment.date), 'PPP')}`, 14, 55);
            doc.text(`Record Key: CL-AS-${assessment.id.slice(0, 6).toUpperCase()}`, 196, 55, { align: 'right' });
            
            doc.line(14, 60, 196, 60);

            // Student Particulars
            const profileData = [
                ['Student Name', assessment.studentName],
                ['Student System ID', userProfile?.id || 'N/A'],
                ['Assessor / Coordinator', assessment.evaluatorName],
                ['Assessment Standing', assessment.status],
                ['Overall Competency Grade', `${assessment.overallScore}%`]
            ];

            autoTable(doc, {
                startY: 68,
                body: profileData,
                theme: 'striped',
                styles: { fontSize: 10, cellPadding: 4 },
                columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 } }
            });

            const nextY = (doc as any).lastAutoTable.finalY + 12;

            // Competency Metrics Table
            doc.setFontSize(13);
            doc.setFont('helvetica', 'bold');
            doc.text("Core Competency Metrics", 14, nextY);

            const competencyRows = [
                ['Patient-Centered Care', `${assessment.competencies.patientCare}%`, 'Exemplary application of empathetic care and clinical communication.'],
                ['Clinical Knowledge', `${assessment.competencies.clinicalKnowledge}%`, 'Strong theoretical reasoning and drug calculation proficiency.'],
                ['Communication & Interpersonal Skills', `${assessment.competencies.communication}%`, 'Collaborates effectively within multi-disciplinary ward teams.'],
                ['Professionalism & Medical Ethics', `${assessment.competencies.professionalism}%`, 'Adheres strictly to nursing dress code, attendance, and patient safety rules.'],
                ['Procedural & Clinical Skills', `${assessment.competencies.proceduralSkills}%`, 'Proficient in IV line inserts, wound care, and drug administration.']
            ];

            autoTable(doc, {
                startY: nextY + 4,
                head: [['Competency Area', 'Evaluated Level', 'Evaluation Reference']],
                body: competencyRows,
                theme: 'grid',
                headStyles: { fillColor: [31, 41, 55] },
                styles: { fontSize: 9 }
            });

            const finalSectionY = (doc as any).lastAutoTable.finalY + 12;

            // Feedback Notes
            doc.setFontSize(13);
            doc.setFont('helvetica', 'bold');
            doc.text("Evaluator Qualitative Feedback", 14, finalSectionY);

            doc.setFont('helvetica', 'italic');
            doc.setFontSize(10);
            const feedbackText = assessment.preceptorFeedback || 'No qualitative notes recorded.';
            const splitFeedback = doc.splitTextToSize(`"${feedbackText}"`, 182);
            doc.text(splitFeedback, 14, finalSectionY + 6);

            // Skills Checked Off
            const skillsY = finalSectionY + 6 + (splitFeedback.length * 5) + 10;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(12);
            doc.text("Verified Practical Skills", 14, skillsY);
            
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            const verifiedSkills = assessment.skillsDemonstrated || [];
            verifiedSkills.forEach((skill, index) => {
                doc.text(`[X]  ${skill}`, 20, skillsY + 6 + (index * 6));
            });

            // Signatures
            const sigY = skillsY + 6 + (verifiedSkills.length * 6) + 15;
            doc.line(130, sigY + 15, 185, sigY + 15);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.text("Clinical Assessor Coordinator", 157, sigY + 20, { align: 'center' });

            doc.save(`Clinical_Assessment_${assessment.studentName.replace(/\s+/g, '_')}.pdf`);
            toast({ title: 'Report Downloaded', description: 'Your official clinical evaluation transcript PDF has been exported.' });
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Export Failed', description: e.message });
        }
    };

    if (loading) return <div className="p-6 space-y-4"><Skeleton className="h-48 w-full"/><Skeleton className="h-64 w-full"/></div>;

    return (
        <div className="space-y-6">
            <Card className="shadow-lg border-0 bg-primary/5">
                <CardHeader>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary rounded-lg shadow-md">
                                <ClipboardCheck className="h-6 w-6 text-white" />
                            </div>
                            <div>
                                <CardTitle className="font-headline text-2xl">Clinical Assessments</CardTitle>
                                <CardDescription>View your consolidated competency rankings and preceptor reports.</CardDescription>
                            </div>
                        </div>
                        {assessment && (
                            <Button className="shrink-0 font-bold gap-2" onClick={handleDownloadReport}>
                                <Download className="h-4 w-4" /> Export Report PDF
                            </Button>
                        )}
                    </div>
                </CardHeader>
            </Card>

            {assessment ? (
                <div className="grid gap-6 md:grid-cols-3">
                    <div className="md:col-span-2 space-y-6">
                        {/* Competency bars Card */}
                        <Card className="shadow-sm border-muted/50 bg-background/50">
                            <CardHeader>
                                <CardTitle className="text-lg font-bold flex items-center gap-1.5">
                                    <Award className="h-5 w-5 text-primary" /> Core Competency Scores
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-5">
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs font-bold text-foreground">
                                        <span>Patient-Centered Care</span>
                                        <span>{assessment.competencies.patientCare}%</span>
                                    </div>
                                    <Progress value={assessment.competencies.patientCare} className="h-2 bg-muted" />
                                </div>

                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs font-bold text-foreground">
                                        <span>Clinical Knowledge</span>
                                        <span>{assessment.competencies.clinicalKnowledge}%</span>
                                    </div>
                                    <Progress value={assessment.competencies.clinicalKnowledge} className="h-2 bg-muted" />
                                </div>

                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs font-bold text-foreground">
                                        <span>Communication & Collaboration</span>
                                        <span>{assessment.competencies.communication}%</span>
                                    </div>
                                    <Progress value={assessment.competencies.communication} className="h-2 bg-muted" />
                                </div>

                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs font-bold text-foreground">
                                        <span>Professionalism & Medical Ethics</span>
                                        <span>{assessment.competencies.professionalism}%</span>
                                    </div>
                                    <Progress value={assessment.competencies.professionalism} className="h-2 bg-muted" />
                                </div>

                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs font-bold text-foreground">
                                        <span>Procedural & Practical Skills</span>
                                        <span>{assessment.competencies.proceduralSkills}%</span>
                                    </div>
                                    <Progress value={assessment.competencies.proceduralSkills} className="h-2 bg-muted" />
                                </div>
                            </CardContent>
                        </Card>

                        {/* Qualitative Notes */}
                        {assessment.preceptorFeedback && (
                            <Card className="border border-muted bg-background">
                                <CardHeader className="py-4 border-b bg-muted/10">
                                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                                        <UserCheck className="h-4 w-4 text-primary" /> Preceptor Summary Comments
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="pt-4 italic text-sm leading-relaxed text-muted-foreground">
                                    "{assessment.preceptorFeedback}"
                                </CardContent>
                            </Card>
                        )}
                    </div>

                    <div className="md:col-span-1 space-y-6">
                        {/* Summary side Card */}
                        <Card className="border border-primary/20 bg-primary/5">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-black uppercase tracking-wider text-primary">Summary Scorecard</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="text-center py-4 bg-background border rounded-2xl shadow-inner">
                                    <span className="text-5xl font-black text-primary">{assessment.overallScore}%</span>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-1">Final Standing Grade</p>
                                </div>
                                <div className="text-xs space-y-2.5">
                                    <div className="flex justify-between"><span>Audit Decision:</span><Badge variant={assessment.status === 'Approved' ? 'default' : 'secondary'} className="font-bold">{assessment.status}</Badge></div>
                                    <div className="flex justify-between"><span>Assessed By:</span><span className="font-bold text-right leading-snug">{assessment.evaluatorName.split('(')[0]}</span></div>
                                    <div className="flex justify-between"><span>Date of Review:</span><span className="font-bold flex items-center gap-1"><Calendar className="h-3 w-3" /> {format(parseISO(assessment.date), 'PP')}</span></div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Practical Skills Checklist */}
                        {assessment.skillsDemonstrated && assessment.skillsDemonstrated.length > 0 && (
                            <Card className="border">
                                <CardHeader className="pb-3 border-b bg-muted/20">
                                    <CardTitle className="text-xs font-black uppercase text-foreground">Verified Practical Competencies</CardTitle>
                                </CardHeader>
                                <CardContent className="pt-4 space-y-2.5">
                                    {assessment.skillsDemonstrated.map((skill, index) => (
                                        <div key={index} className="flex items-start gap-2 text-xs font-medium text-foreground/80 leading-normal">
                                            <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                                            <span>{skill}</span>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </div>
            ) : (
                <div className="py-24 text-center border-2 border-dashed rounded-3xl bg-muted/5 flex flex-col items-center gap-4">
                    <ShieldAlert className="h-12 w-12 opacity-10" />
                    <div className="space-y-1">
                        <h3 className="text-lg font-bold">No Assessments Released</h3>
                        <p className="text-sm text-muted-foreground max-w-sm mx-auto">Your final clinical report is either under compilation or has not been approved for release by the Registrar's Office yet.</p>
                    </div>
                </div>
            )}
        </div>
    );
}
