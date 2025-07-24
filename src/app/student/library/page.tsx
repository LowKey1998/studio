
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Book, Search } from 'lucide-react';
import Image from 'next/image';

const mockBooks = [
  {
    id: '1',
    title: 'Introduction to Quantum Mechanics',
    author: 'David J. Griffiths',
    imageUrl: 'https://placehold.co/150x200.png',
    copiesAvailable: 3,
    dataAiHint: 'physics book'
  },
  {
    id: '2',
    title: 'Clean Code: A Handbook of Agile Software Craftsmanship',
    author: 'Robert C. Martin',
    imageUrl: 'https://placehold.co/150x200.png',
    copiesAvailable: 5,
    dataAiHint: 'software development'
  },
  {
    id: '3',
    title: 'The Structure of Scientific Revolutions',
    author: 'Thomas S. Kuhn',
    imageUrl: 'https://placehold.co/150x200.png',
    copiesAvailable: 2,
    dataAiHint: 'philosophy science'
  },
  {
    id: '4',
    title: 'Calculus: Early Transcendentals',
    author: 'James Stewart',
    imageUrl: 'https://placehold.co/150x200.png',
    copiesAvailable: 0,
    dataAiHint: 'math textbook'
  },
    {
    id: '5',
    title: 'Organic Chemistry',
    author: 'Paula Yurkanis Bruice',
    imageUrl: 'https://placehold.co/150x200.png',
    copiesAvailable: 1,
    dataAiHint: 'chemistry textbook'
  },
  {
    id: '6',
    title: 'Fundamentals of Corporate Finance',
    author: 'Stephen A. Ross',
    imageUrl: 'https://placehold.co/150x200.png',
    copiesAvailable: 8,
    dataAiHint: 'finance book'
  },
];

export default function LibraryPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Library Catalog</CardTitle>
          <CardDescription>Browse and borrow books from our collection.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input placeholder="Search by title, author, or keyword..." className="pl-10" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {mockBooks.map((book) => (
              <Card key={book.id} className="overflow-hidden flex flex-col">
                <div className="relative w-full h-48 bg-secondary">
                   <Image
                      src={book.imageUrl}
                      alt={book.title}
                      layout="fill"
                      objectFit="cover"
                      data-ai-hint={book.dataAiHint}
                    />
                </div>
                <CardHeader className="flex-grow">
                  <CardTitle className="text-base">{book.title}</CardTitle>
                  <CardDescription>{book.author}</CardDescription>
                </CardHeader>
                <CardContent className="mt-auto">
                   <p className={`text-sm ${book.copiesAvailable > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {book.copiesAvailable > 0 ? `${book.copiesAvailable} copies available` : 'Out of stock'}
                  </p>
                  <Button className="w-full mt-4" disabled={book.copiesAvailable === 0}>
                    <Book className="mr-2 h-4 w-4" />
                    Borrow
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
