import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileQuestion, HelpCircle, Clock, ChevronRight } from "lucide-react";

const quizzes = [
  { title: "Calculus II - Chapter 3 Quiz", course: "MATH-201", questions: 15, timeLimit: "30 mins", status: "Not Started" },
  { title: "Physics: Midterm Review", course: "PHY-102", questions: 25, timeLimit: "45 mins", status: "Not Started" },
  { title: "Literary Devices Pop Quiz", course: "ENG-301", questions: 10, timeLimit: "15 mins", status: "Completed", score: "8/10" },
  { title: "Roman Republic Knowledge Check", course: "HIST-210", questions: 20, timeLimit: "20 mins", status: "Not Started" },
  { title: "Data Structures: Big O Notation", course: "CS-450", questions: 12, timeLimit: "25 mins", status: "Completed", score: "12/12" },
];

export default function QuizzesPage() {
  return (
    <div className="space-y-6">
       <Card className="shadow-lg border-0">
          <CardHeader>
            <CardTitle className="font-headline text-2xl">Quizzes & Exams</CardTitle>
            <CardDescription>Test your knowledge. Select a quiz to begin.</CardDescription>
          </CardHeader>
      </Card>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {quizzes.map((quiz, index) => (
          <Card key={index} className="flex flex-col justify-between shadow-lg transition-all duration-300 hover:shadow-xl">
            <CardHeader>
              <CardTitle className="font-headline">{quiz.title}</CardTitle>
              <CardDescription>{quiz.course}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-around text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <HelpCircle className="h-4 w-4" />
                  <span>{quiz.questions} Questions</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>{quiz.timeLimit}</span>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between items-center bg-muted/50 px-6 py-4">
              {quiz.status === 'Completed' ? (
                <div className="font-semibold">
                  <p className="text-sm text-muted-foreground">Score</p>
                  <p className="text-lg text-primary">{quiz.score}</p>
                </div>
              ) : (
                <p className="text-sm font-semibold text-muted-foreground">Not Started</p>
              )}
              <Button disabled={quiz.status === 'Completed'}>
                {quiz.status === 'Completed' ? 'View Results' : 'Start Quiz'}
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
