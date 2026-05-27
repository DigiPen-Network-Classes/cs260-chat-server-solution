import chalk, { type ChalkInstance } from 'chalk';

type Severity = "DEBUG" | "INFO" | "SUCCESS" | "WARNING" | "ERROR" | "FATAL";

const Levels: { [key in Severity]: {
    level: number;
    color: keyof ChalkInstance;
} } = {
    DEBUG:   { level: -1, color: "gray"      },
    INFO:    { level:  0, color: "white"     },
    SUCCESS: { level:  1, color: "green"     },
    WARNING: { level:  2, color: "yellow"    },
    ERROR:   { level:  3, color: "redBright" },
    FATAL:   { level:  4, color: "red"       }
};

const maxLen = Math.max(...Object.keys(Levels).map(k => k.length));

const Log = (severity: Severity, message: string) => {
    const now = new Date();

    const yyyy = now.getFullYear();
    const mm   = String(now.getMonth() + 1).padStart(2, '0');
    const dd   = String(now.getDate()).padStart(2, '0');
    const hh   = String(now.getHours()).padStart(2, '0');
    const min  = String(now.getMinutes()).padStart(2, '0');
    const ss   = String(now.getSeconds()).padStart(2, '0');

    const timestamp = `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
    const color     = Levels[severity].color;

    const ts  = chalk.dim(`[${timestamp}]`);
    const tag = (chalk[color] as ChalkInstance)(`[${severity}]`.padEnd(maxLen + 2));
    const msg = (chalk[color] as ChalkInstance)(message);

    console.log(`${ts} ${tag} ${msg}`);
};

Log.debug   = (message: string) => Log("DEBUG",   message);
Log.info    = (message: string) => Log("INFO",    message);
Log.success = (message: string) => Log("SUCCESS", message);
Log.warning = (message: string) => Log("WARNING", message);
Log.error   = (message: string) => Log("ERROR",   message);
Log.fatal   = (message: string) => Log("FATAL",   message);

export default Log;