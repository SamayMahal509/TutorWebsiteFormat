import dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';

// Load environmental variables from .env file
dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware to parse body payload
  app.use(express.json());

  // API endpoint for submitting a Customized Study Plan
  app.post('/api/submit-plan', async (req, res) => {
    try {
      console.log('--- RECEIVED STUDY PLAN REQUEST ---');
      console.log('Payload:', req.body);

      const {
        parentName,
        studentName,
        email,
        phone,
        subject,
        location,
        sessionFormat,
        message,
        planType
      } = req.body;

      // Validate required inputs
      if (!parentName || !studentName || !email || !phone) {
        console.warn('Validation failed: missing required contact info');
        return res.status(400).json({ error: 'Missing required contact information fields.' });
      }

      const submission = {
        id: `sub_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        timestamp: new Date().toISOString(),
        parentName,
        studentName,
        email,
        phone,
        subject,
        location,
        sessionFormat,
        message,
        planType
      };

      // Ensure submissions.json persists safely on server side
      const submissionsPath = path.join(process.cwd(), 'submissions.json');
      let submissionsList = [];
      if (fs.existsSync(submissionsPath)) {
        try {
          const rawData = fs.readFileSync(submissionsPath, 'utf-8');
          submissionsList = JSON.parse(rawData);
        } catch (e) {
          console.error('Error reading/parsing submissions.json:', e);
        }
      }
      submissionsList.push(submission);
      fs.writeFileSync(submissionsPath, JSON.stringify(submissionsList, null, 2), 'utf-8');
      console.log(`Saved submission locally under ${submissionsPath}`);

      // Optional secondary backup if RESEND_API_KEY is also present (otherwise skips with log)
      const resendApiKey = process.env.RESEND_API_KEY;
      let emailSent = false;
      let emailError = null;

      if (resendApiKey) {
        console.log('Secondary backup: RESEND_API_KEY detected. Dispatching duplicate backup email...');
        try {
          const subjectText = `[BACKUP] New NOVA Study Plan Request - ${parentName} for ${studentName}`;
          const htmlContent = `
            <div style="font-family: sans-serif; max-width: 600px; color: #111827; line-height: 1.6; border: 1px solid #E5E7EB; border-radius: 12px; padding: 24px; background-color: #FFFFFF;">
              <h2 style="color: #059669; border-bottom: 2px solid #E5E7EB; padding-bottom: 12px; margin-top: 0;">NOVA Tutoring Study Plan Request [BACKUP]</h2>
              <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
                <tr><td style="padding: 10px 0; font-weight: bold;">Parent Name:</td><td>${parentName}</td></tr>
                <tr><td style="padding: 10px 0; font-weight: bold;">Student Name:</td><td>${studentName}</td></tr>
                <tr><td style="padding: 10px 0; font-weight: bold;">Email:</td><td>${email}</td></tr>
                <tr><td style="padding: 10px 0; font-weight: bold;">Phone:</td><td>${phone}</td></tr>
                <tr><td style="padding: 10px 0; font-weight: bold;">Subject:</td><td>${subject}</td></tr>
                <tr><td style="padding: 10px 0; font-weight: bold;">Location:</td><td>${location}</td></tr>
                <tr><td style="padding: 10px 0; font-weight: bold;">Format:</td><td>${sessionFormat}</td></tr>
                <tr><td style="padding: 10px 0; font-weight: bold;">Message:</td><td>${message}</td></tr>
              </table>
            </div>
          `;
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${resendApiKey}`
            },
            body: JSON.stringify({
              from: 'NOVA Tutoring <onboarding@resend.dev>',
              to: 'samaymahal@aol.com',
              subject: subjectText,
              html: htmlContent
            })
          });
          emailSent = true;
        } catch (backupErr: any) {
          emailError = backupErr.message || backupErr;
          console.error('Non-blocking Resend backup fails:', backupErr);
        }
      }

      return res.status(200).json({
        success: true,
        submissionId: submission.id,
        emailSent,
        emailError: emailError ? true : false
      });
    } catch (err: any) {
      console.error('Error processing customized plan submission:', err);
      return res.status(500).json({ error: 'Server exploded while processing your request.' });
    }
  });

  // Serve static dist in production, or mount Vite dev middleware in dev
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

startServer();
