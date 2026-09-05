import { AppError } from "@webrecon/shared";

export class JobTimeoutError extends AppError {
  constructor(timeoutMs: number) {
    super("JOB_TIMEOUT", `Job exceeded its ${timeoutMs}ms timeout`, 504);
  }
}

/** Races `work` against a timer; rejects with JobTimeoutError if the timer wins. */
export async function withTimeout<T>(work: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new JobTimeoutError(timeoutMs)), timeoutMs);
  });

  try {
    return await Promise.race([work, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}
