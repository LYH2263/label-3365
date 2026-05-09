export function uniqueTag(testInfo) {
  const project = testInfo.project.name.includes('mobile') ? 'm' : 'd';
  const rand = Math.random().toString(36).slice(2, 6);
  const time = Date.now().toString(36).slice(-6);
  return `${project}${time}${rand}`;
}

export function buildCustomer(testInfo, prefix = 'cust') {
  const tag = uniqueTag(testInfo);
  const username = `${prefix}_${tag}`.slice(0, 30);
  return {
    username,
    password: 'Customer@123',
    displayName: `顾客${tag}`,
    phone: '13800138000'
  };
}

export function buildDishName(testInfo, prefix = '测试菜') {
  return `${prefix}_${uniqueTag(testInfo)}`;
}

export function longText(length) {
  return 'x'.repeat(length);
}
