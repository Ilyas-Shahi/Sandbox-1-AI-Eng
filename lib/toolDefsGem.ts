import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { success } from 'zod';

export const weatherToolDec = {
  name: 'get_weather',
  description: 'Gets the weather for a given location.',
  parameters: {
    type: 'object',
    properties: {
      location: { type: 'string', description: 'The city and state' },
      latitude: {
        type: 'string',
        description: 'The latitude of the city/location',
      },
      longitude: {
        type: 'string',
        description: 'The longitude of the city/location',
      },
    },
    required: ['location', 'latitude', 'longitude'],
  },
};

// API for getting current weather
async function get_weather(toolArgs: Record<string, string>) {
  const { location, latitude, longitude } = toolArgs;

  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m`,
    );

    const resData = await res.json();

    if (res.status === 200) {
      return {
        success: true,
        data: {
          location,
          temperature: resData.current.temperature_2m,
          unit: resData.current_units.temperature_2m,
        },
      };
    } else {
      return { success: false };
    }
  } catch (error) {
    return { success: false, data: error };
  }
}

// ----- Read/Write meetings/schedule
const dbFileDir = path.join(process.cwd(), 'app/api/chat-tools/schedule.json');

// Read meetings tool declaration
export const readMeetingToolDec = {
  name: 'get_meeting',
  description: 'Get one or many Meetings for a date or range.',
  parameters: {
    type: 'object',
    properties: {
      range: {
        type: 'string',
        description: 'The date for the meetings to read/fetch.',
      },
      title: {
        type: 'string',
        description: 'The title of the scheduled meeting.',
      },
      date: {
        type: 'string',
        description: 'The scheduled date for the meeting. Format = DD-MM-YYYY',
      },
      time: {
        type: 'string',
        description: 'The scheduled time for the meeting.',
      },
    },
    required: ['range', 'title', 'date', 'time'],
  },
};

async function get_meeting(toolArgs: Record<string, string>) {
  // const { range, title, date, time } = toolArgs;

  try {
    const currMeetingsDataJSON = await readFile(dbFileDir, 'utf-8');
    const currMeetingsData = JSON.parse(currMeetingsDataJSON);

    return {
      success: true,
      data: { arguments: toolArgs, allMeetings: currMeetingsData },
    };
  } catch (error) {
    console.error(error);
    return { success: false, data: error };
  }
}

// Write a meeting tool declaration
export const writeMeetingToolDec = {
  name: 'write_meeting',
  description: 'Schedule a meeting from the provided data.',
  parameters: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'The title of the scheduled meeting.',
      },
      date: {
        type: 'string',
        description: 'The scheduled date for the meeting. Format = DD-MM-YYYY',
      },
      time: {
        type: 'string',
        description: 'The scheduled time for the meeting.',
      },
    },
    required: ['title', 'date', 'time'],
  },
};

async function write_meeting(toolArgs: Record<string, string>) {
  try {
    const { title, date, time } = toolArgs;

    const currMeetingsDataJSON = await readFile(dbFileDir, 'utf-8');
    const currMeetingsData = JSON.parse(currMeetingsDataJSON);

    currMeetingsData.push({
      id: crypto.randomUUID(),
      title,
      date,
      time,
    });

    await writeFile(dbFileDir, JSON.stringify(currMeetingsData, null, 2));

    return { success: true, data: toolArgs };
  } catch (error) {
    console.error(error);
    return { success: false, data: error };
  }
}

export const toolDefs = {
  get_weather,
  get_meeting,
  write_meeting,
};
