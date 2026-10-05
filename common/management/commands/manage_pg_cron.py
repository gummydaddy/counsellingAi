"""Django management command to manage pg_cron scheduled jobs."""

from django.core.management.base import BaseCommand
from django.db import connection


class Command(BaseCommand):
    help = 'Manage pg_cron scheduled jobs'

    def add_arguments(self, parser):
        parser.add_argument(
            'action',
            choices=['schedule', 'unschedule', 'list', 'run'],
            help='Action to perform'
        )
        parser.add_argument(
            '--job-name',
            type=str,
            help='Name of the cron job'
        )
        parser.add_argument(
            '--schedule',
            type=str,
            help='Cron schedule expression (e.g., "0 2 * * *" for daily at 2 AM)'
        )
        parser.add_argument(
            '--command',
            type=str,
            help='SQL command to execute'
        )
        parser.add_argument(
            '--database',
            type=str,
            default='postgres',
            help='Database name (default: postgres)'
        )

    def handle(self, *args, **options):
        action = options['action']

        with connection.cursor() as cursor:
            if action == 'schedule':
                job_name = options['job_name']
                schedule = options['schedule']
                command = options['command']
                database = options['database']

                if not all([job_name, schedule, command]):
                    self.stderr.write('Error: --job-name, --schedule, and --command are required for schedule action')
                    return

                self.stdout.write(f'Scheduling job "{job_name}" with schedule "{schedule}"...')
                cursor.execute(
                    "SELECT cron.schedule(%s, %s, %s, %s);",
                    [job_name, schedule, command, database]
                )
                self.stdout.write(self.style.SUCCESS(f'Job "{job_name}" scheduled successfully'))

            elif action == 'unschedule':
                job_name = options['job_name']
                if not job_name:
                    self.stderr.write('Error: --job-name is required for unschedule action')
                    return

                self.stdout.write(f'Unscheduling job "{job_name}"...')
                cursor.execute("SELECT cron.unschedule(%s);", [job_name])
                self.stdout.write(self.style.SUCCESS(f'Job "{job_name}" unscheduled successfully'))

            elif action == 'list':
                self.stdout.write('Listing all pg_cron jobs...')
                cursor.execute('''
                    SELECT jobid, jobname, schedule, command, nodename, nodeport, database, active
                    FROM cron.job
                    ORDER BY jobid;
                ''')
                jobs = cursor.fetchall()
                if jobs:
                    for job in jobs:
                        self.stdout.write(f'  ID: {job[0]}, Name: {job[1]}, Schedule: {job[2]}, Active: {job[7]}')
                        self.stdout.write(f'    Command: {job[3]}')
                        self.stdout.write(f'    DB: {job[5]}:{job[6]}/{job[6]}')
                else:
                    self.stdout.write('  No jobs scheduled')

            elif action == 'run':
                job_name = options['job_name']
                if not job_name:
                    self.stderr.write('Error: --job-name is required for run action')
                    return

                self.stdout.write(f'Running job "{job_name}" immediately...')
                cursor.execute("SELECT cron.run_job(%s);", [job_name])
                self.stdout.write(self.style.SUCCESS(f'Job "{job_name}" executed'))