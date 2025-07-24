
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, FileText, FileType } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const mockResources = [
  {
    id: '1',
    title: 'Academic Calendar 2024-2025',
    description: 'The official academic calendar for the upcoming year.',
    fileUrl: '#', // Placeholder URL
    fileType: 'PDF',
    category: 'General',
  },
  {
    id: '2',
    title: 'Student Handbook',
    description: 'Rules, regulations, and important information for all students.',
    fileUrl: '#',
    fileType: 'PDF',
    category: 'General',
  },
  {
    id: '3',
    title: 'Physics 101 - Lecture Notes Week 1',
    description: 'Lecture notes covering the first week of Physics 101.',
    fileUrl: '#',
    fileType: 'PDF',
    category: 'Course Material',
  },
  {
    id: '4',
    title: 'Library Usage Policy',
    description: 'Guidelines for borrowing and using library resources.',
    fileUrl: '#',
    fileType: 'DOCX',
    category: 'Library',
  },
  {
    id: '5',
    title: 'Scholarship Application Form',
    description: 'Form to apply for available university scholarships.',
    fileUrl: '#',
    fileType: 'PDF',
    category: 'Financial Aid',
  },
];

export default function ResourcesPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Student Resources</CardTitle>
          <CardDescription>Find and download important documents, forms, and course materials.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-4">
            {mockResources.map((resource) => (
              <li key={resource.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-secondary/50 transition-colors">
                <div className="flex items-center gap-4">
                  <FileType className="h-8 w-8 text-primary" />
                  <div>
                    <h3 className="font-semibold">{resource.title}</h3>
                    <p className="text-sm text-muted-foreground">{resource.description}</p>
                    <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline">{resource.category}</Badge>
                        <Badge variant="secondary">{resource.fileType}</Badge>
                    </div>
                  </div>
                </div>
                <Button asChild>
                  <a href={resource.fileUrl} download>
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </a>
                </Button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
