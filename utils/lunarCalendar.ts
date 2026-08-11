/**
 * Thuật toán quy đổi Dương Lịch sang Âm Lịch Việt Nam (Vietnamese Lunar Calendar Algorithm)
 * Dựa trên thuật toán chuẩn của Hồ Ngọc Đức.
 */

export interface LunarDate {
  day: number;
  month: number;
  year: number;
  isLeapMonth: boolean;
}

// Hằng số tính JULIAN DAY NUMBER
function getJulianDay(day: number, month: number, year: number): number {
  let a = Math.floor((14 - month) / 12);
  let y = year + 4800 - a;
  let m = month + 12 * a - 3;
  return (
    day +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045
  );
}

// Tính Kinh độ Mặt Trời (Sun Longitude) ở múi giờ UTC+7 (Việt Nam)
function getSunLongitude(jdn: number, timeZone: number = 7): number {
  let T = (jdn - 2451545.0 + timeZone / 24.0) / 36525.0;
  let dr = Math.PI / 180.0;
  let M = 357.5291 + 35999.0503 * T - 0.0001559 * T * T - 0.00000048 * T * T * T;
  let L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T * T;
  let DL = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(M * dr) +
           (0.019993 - 0.000101 * T) * Math.sin(2 * M * dr) +
           0.000289 * Math.sin(3 * M * dr);
  let L = L0 + DL;
  L = L * dr;
  L = L - 2 * Math.PI * Math.floor(L / (2 * Math.PI));
  return L;
}

// Tính điểm Sóc (New Moon) gần nhất
function getNewMoonDay(k: number, timeZone: number = 7): number {
  let T = k / 1236.85;
  let dr = Math.PI / 180.0;
  let Jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T * T - 0.000000155 * T * T * T;
  let M = 359.2242 + 29.10535608 * k - 0.0000333 * T * T - 0.00000347 * T * T * T;
  let Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T * T + 0.00001236 * T * T * T;
  let F = 21.2964 + 390.67050646 * k - 0.0016528 * T * T - 0.00000239 * T * T * T;
  
  let C1 = (0.1734 - 0.000393 * T) * Math.sin(M * dr) + 0.0021 * Math.sin(2 * M * dr);
  C1 = C1 - 0.4068 * Math.sin(Mpr * dr) + 0.0161 * Math.sin(2 * Mpr * dr);
  C1 = C1 - 0.0004 * Math.sin(3 * Mpr * dr);
  C1 = C1 + 0.0104 * Math.sin(2 * F * dr) - 0.0051 * Math.sin((M + Mpr) * dr);
  C1 = C1 - 0.0074 * Math.sin((M - Mpr) * dr) + 0.0004 * Math.sin((2 * F + M) * dr);
  C1 = C1 - 0.0004 * Math.sin((2 * F - M) * dr) - 0.0006 * Math.sin((2 * F + Mpr) * dr);
  C1 = C1 + 0.001 * Math.sin((2 * F - Mpr) * dr) + 0.0005 * Math.sin((M + 2 * Mpr) * dr);
  
  let JdNew = Jd1 + C1;
  return Math.floor(JdNew + 0.5 + timeZone / 24.0);
}

// Chuyển đổi Ngày Dương Lịch sang Ngày Âm Lịch Việt Nam
export function convertSolarToLunar(solarDay: number, solarMonth: number, solarYear: number, timeZone: number = 7): LunarDate {
  let jdn = getJulianDay(solarDay, solarMonth, solarYear);
  let k = Math.floor((jdn - 2415021.07699) / 29.53058868);
  
  let newMoon = getNewMoonDay(k, timeZone);
  if (newMoon > jdn) {
    k--;
    newMoon = getNewMoonDay(k, timeZone);
  }
  
  let a11 = getNewMoonDay(Math.floor((getJulianDay(31, 12, solarYear - 1) - 2415021.07699) / 29.53058868), timeZone);
  if (getSunLongitude(a11, timeZone) >= 3 * Math.PI / 2) {
    a11 = getNewMoonDay(Math.floor((getJulianDay(31, 12, solarYear - 1) - 2415021.07699) / 29.53058868) - 1, timeZone);
  }

  let day = jdn - newMoon + 1;
  let month = Math.floor((newMoon - a11) / 29.5) + 12;
  if (month > 12) month -= 12;
  if (month === 0) month = 12;

  let year = solarYear;
  if (solarMonth < 3 && month > 9) {
    year--;
  }

  return {
    day,
    month,
    year,
    isLeapMonth: false
  };
}

/**
 * Kiếm tra xem ngày hiện tại (Dương hoặc Âm) có nằm trong khoảng thời gian cấu hình hay không.
 */
export function isDateInSchedule(
  currentDate: Date,
  schedule: {
    enabled: boolean;
    calendarType: 'SOLAR' | 'LUNAR';
    startMonth: number;
    startDay: number;
    endMonth: number;
    endDay: number;
    yearSpecific?: number | null;
  }
): boolean {
  if (!schedule.enabled) return false;

  let targetDay: number;
  let targetMonth: number;
  let targetYear: number;

  if (schedule.calendarType === 'LUNAR') {
    const lunar = convertSolarToLunar(
      currentDate.getDate(),
      currentDate.getMonth() + 1,
      currentDate.getFullYear()
    );
    targetDay = lunar.day;
    targetMonth = lunar.month;
    targetYear = lunar.year;
  } else {
    targetDay = currentDate.getDate();
    targetMonth = currentDate.getMonth() + 1;
    targetYear = currentDate.getFullYear();
  }

  if (schedule.yearSpecific && schedule.yearSpecific !== targetYear) {
    return false;
  }

  // Chuyển tháng & ngày thành số thứ tự trong năm (Vd: 0215 cho 15/02, 0101 cho 01/01)
  const currentVal = targetMonth * 100 + targetDay;
  const startVal = schedule.startMonth * 100 + schedule.startDay;
  const endVal = schedule.endMonth * 100 + schedule.endDay;

  if (startVal <= endVal) {
    // Khoảng thời gian trong cùng 1 năm (Vd: 02/01 - 02/10)
    return currentVal >= startVal && currentVal <= endVal;
  } else {
    // Khoảng thời gian vắt qua năm mới (Vd: 12/25 - 01/05)
    return currentVal >= startVal || currentVal <= endVal;
  }
}
