package com.fitplan;

import com.fitplan.config.DotEnv;
import com.fitplan.config.FitplanProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication(exclude = UserDetailsServiceAutoConfiguration.class)
@EnableScheduling
@EnableConfigurationProperties(FitplanProperties.class)
public class FitplanApiApplication {

    public static void main(String[] args) {
        DotEnv.apply();
        SpringApplication.run(FitplanApiApplication.class, args);
    }
}
