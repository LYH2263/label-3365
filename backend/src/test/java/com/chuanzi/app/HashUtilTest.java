package com.chuanzi.app;

import com.chuanzi.app.util.HashUtil;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;

class HashUtilTest {
    @Test
    void shouldGenerateStableHash() {
        String hash = HashUtil.hashPassword("Merchant@123", "chuanzi-default-salt");
        Assertions.assertEquals("eba4329da41dcee7e8a71fb60e09b0a5ea5df037464aed002cd9f3ba96eb4e6d", hash);
    }
}
