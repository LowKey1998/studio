'use server';
/**
 * @fileOverview An AI agent for generating a conflict-free weekly timetable.
 */
import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { db } from '@/lib/firebase';
import { ref, get, set } from 'firebase/database';

// Define schemas for the inputs and outputs of the AI flow.

const CourseInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  lecturerId: z.string(),
  studentIds: z.array(z.string()),
});

const RoomInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  capacity: z.number(),
});

const TimetableConstraintsSchema = z.object({
  days: z.array(z.string()),
  startTime: z.string(),
  endTime: z.string(),
  sessionDuration: z.number().describe('Duration of each class session in minutes'),
});

const TimetableInputSchema = z.object({
  semesterId: z.string(),
  semesterName: z.string(),
  courses: z.array(CourseInfoSchema),
  rooms: z.array(RoomInfoSchema),
  constraints: TimetableConstraintsSchema,
});
export type TimetableInput = z.infer<typeof TimetableInputSchema>;

const TimetableEntrySchema = z.object({
  courseId: z.string(),
  day: z.string(),
  startTime: z.string().describe('Format as HH:MM'),
  endTime: z.string().describe('Format as HH:MM'),
  venue: z.string().describe('The name of the room'),
});

const TimetableOutputSchema = z.object({
  semesterId: z.string(),
  timetable: z.record(z.array(TimetableEntrySchema)).describe('A map where the key is the courseId and the value is an array of its scheduled sessions.')
});
export type TimetableOutput = z.infer<typeof TimetableOutputSchema>;


const generateTimetablePrompt = ai.definePrompt({
    name: 'generateTimetablePrompt',
    input: { schema: TimetableInputSchema },
    output: { schema: TimetableOutputSchema },
    prompt: `You are a master scheduler for a university. Your task is to generate a weekly class timetable for a given semester.

You must adhere to the following constraints:
1.  **No Conflicts:** A lecturer cannot teach two different classes at the same time.
2.  **No Student Clashes:** A student cannot be scheduled for two different classes at the same time.
3.  **Room Capacity:** The number of students in a class must not exceed the capacity of the assigned room.
4.  **Operating Hours:** All classes must be scheduled between {{{constraints.startTime}}} and {{{constraints.endTime}}} on the specified days: {{{constraints.days}}}.
5.  **Session Duration:** Each class session must last for {{{constraints.sessionDuration}}} minutes.

**Available Rooms:**
{{#each rooms}}
- Room: {{name}}, Capacity: {{capacity}}
{{/each}}

**Courses to Schedule:**
{{#each courses}}
- Course ID: {{id}}, Name: "{{name}}", Lecturer ID: {{lecturerId}}, Enrolled Students: {{studentIds.length}}
  - Student IDs: {{#join studentIds ", "}}{{this}}{{/join}}
{{/each}}

Based on all this information, generate the complete, conflict-free timetable. The output must be a JSON object matching the specified output schema.
`,
});


const generateTimetableFlow = ai.defineFlow(
  {
    name: 'generateTimetableFlow',
    inputSchema: TimetableInputSchema,
    outputSchema: TimetableOutputSchema,
  },
  async (input) => {
    const { output } = await generateTimetablePrompt(input);
    if (!output) {
      throw new Error('Failed to generate timetable from the AI model.');
    }
    return output;
  }
);


// --- Main exported function ---
export async function generateFullTimetable(): Promise<{ message: string }> {
  try {
    // 1. Fetch all necessary data from Firebase
    const [semestersSnap, coursesSnap, usersSnap, roomsSnap, regsSnap] = await Promise.all([
      get(ref(db, 'semesters')),
      get(ref(db, 'courses')),
      get(ref(db, 'users')),
      get(ref(db, 'settings/rooms')),
      get(ref(db, 'registrations')),
    ]);

    if (!semestersSnap.exists() || !coursesSnap.exists() || !usersSnap.exists() || !roomsSnap.exists() || !regsSnap.exists()) {
      throw new Error("Missing essential data (semesters, courses, users, rooms, or registrations).");
    }

    const allSemesters = semestersSnap.val();
    const allCourses = coursesSnap.val();
    const allRooms = roomsSnap.val();
    const allRegistrations = regsSnap.val();

    const activeSemesters = Object.entries(allSemesters).filter(([, sem]: [string, any]) => sem.status === 'Open');
    
    if (activeSemesters.length === 0) {
        return { message: "No active semesters to generate timetables for." };
    }
    
    // 2. Prepare input for the AI flow for each active semester
    const timetablePromises = activeSemesters.map(async ([semesterId, semesterData]: [string, any]) => {
      const coursesInSemester: any[] = [];
      const studentsByCourse: Record<string, string[]> = {};

      Object.entries(allRegistrations).forEach(([userId, userRegs]: [string, any]) => {
        if (userRegs[semesterId]) {
          userRegs[semesterId].courses.forEach((courseId: string) => {
            if (!studentsByCourse[courseId]) {
              studentsByCourse[courseId] = [];
            }
            studentsByCourse[courseId].push(userId);
          });
        }
      });
      
      Object.keys(studentsByCourse).forEach(courseId => {
          if(allCourses[courseId]) {
              coursesInSemester.push({
                  id: courseId,
                  name: allCourses[courseId].name,
                  lecturerId: allCourses[courseId].lecturerId,
                  studentIds: studentsByCourse[courseId]
              });
          }
      });

      const flowInput: TimetableInput = {
        semesterId,
        semesterName: semesterData.name,
        courses: coursesInSemester,
        rooms: Object.entries(allRooms).map(([id, room]: [string, any]) => ({ id, ...room })),
        constraints: {
          days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
          startTime: "08:00",
          endTime: "17:00",
          sessionDuration: 120, // 2 hours
        },
      };

      // 3. Call the AI flow
      return generateTimetableFlow(flowInput);
    });

    const results = await Promise.all(timetablePromises);

    // 4. Save the generated timetables back to Firebase
    for (const result of results) {
      const timetableRef = ref(db, `timetables/${result.semesterId}`);
      
      const newTimetable: Record<string, any> = {};
      Object.entries(result.timetable).forEach(([courseId, entries]) => {
        newTimetable[courseId] = {};
        entries.forEach(entry => {
          const entryId = push(ref(db)).key!;
          newTimetable[courseId][entryId] = entry;
        });
      });

      await set(timetableRef, newTimetable);
    }

    return { message: `Successfully generated timetables for ${results.length} active semester(s).` };
  } catch (error: any) {
    console.error("Error in generateFullTimetable:", error);
    throw new Error(`Failed to generate timetables: ${error.message}`);
  }
}
