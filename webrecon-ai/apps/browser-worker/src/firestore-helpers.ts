import { getFirebaseAdminFirestore } from "@webrecon/firebase/admin";
import { COLLECTIONS } from "@webrecon/firebase";
import { NotFoundError } from "@webrecon/shared";
import { Project } from "@webrecon/types";

export async function getProjectOrThrow(projectId: string): Promise<Project> {
  const doc = await getFirebaseAdminFirestore().collection(COLLECTIONS.projects).doc(projectId).get();
  if (!doc.exists) throw new NotFoundError(`Project not found: ${projectId}`);
  return Project.parse(doc.data());
}
